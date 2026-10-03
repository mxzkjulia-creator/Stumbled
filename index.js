require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const queues = new Map();
const privateMatches = new Map();

const INACTIVITY_MS = 180000;

// ==========================
// COMANDOS
// ==========================

const commands = [
  new SlashCommandBuilder()
    .setName("painel")
    .setDescription("Criar painel de aposta")
    .addStringOption(o =>
      o
        .setName("valor")
        .setDescription("Valor da aposta")
        .setRequired(true)
    )
    .addStringOption(o =>
      o
        .setName("modo")
        .setDescription("Modo da partida")
        .setRequired(true)
        .addChoices(
          { name: "1v1", value: "1v1" },
          { name: "2v2", value: "2v2" },
          { name: "3v3", value: "3v3" }
        )
    )
    .addStringOption(o =>
      o
        .setName("plataforma")
        .setDescription("Plataforma")
        .setRequired(true)
        .addChoices(
          { name: "PC", value: "PC" },
          { name: "Mobile", value: "Mobile" },
          { name: "Misto", value: "Misto" }
        )
    )
    .addStringOption(o =>
      o
        .setName("mensagem")
        .setDescription("Nome do mapa")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("cancelar")
    .setDescription("Cancelar a partida atual")
];

// ==========================
// STAFF
// ==========================

function isStaff(member) {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageChannels)
  );
}

// ==========================
// PAINEL DA FILA
// ==========================

function queueEmbed(match) {
  return new EmbedBuilder()
    .setTitle("🎯 Apostas")
    .setDescription(
      `**Mapa:** ${match.map}\n` +
      `**Modo:** ${match.mode}\n` +
      `**Plataforma:** ${match.platform}\n` +
      `**Valor:** ${match.value}\n\n` +
      `👥 **Jogadores:** ${match.players.length}/${match.maxPlayers}\n\n` +
      `Clique em **Entrar** para participar.`
    );
}

function queueButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("join")
        .setLabel("Entrar")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("leave")
        .setLabel("Sair")
        .setEmoji("❌")
        .setStyle(ButtonStyle.Danger)
    )
  ];
}

// ==========================
// PAINEL DA PARTIDA
// ==========================

function matchEmbed(match) {
  const half = Math.ceil(match.players.length / 2);

  const team1 = match.players
    .slice(0, half)
    .map(id => `<@${id}>`)
    .join("\n");

  const team2 = match.players
    .slice(half)
    .map(id => `<@${id}>`)
    .join("\n");

  return new EmbedBuilder()
    .setTitle("🎮 Partida encontrada!")
    .setDescription(
      `**Mapa:** ${match.map}\n` +
      `**Modo:** ${match.mode}\n` +
      `**Plataforma:** ${match.platform}\n` +
      `**Valor (por jogador):** ${match.value}\n` +
      `**Mediador:** <@${match.mediator}>\n\n` +

      `🔵 **Time 1**\n` +
      `${team1 || "Ninguém"}\n\n` +

      `🔴 **Time 2**\n` +
      `${team2 || "Ninguém"}\n\n` +

      `📜 **Regras**\n` +
      `• Joguem a partida normalmente.\n` +
      `• Enviem o print do resultado aqui.\n` +
      `• Somente a staff pode confirmar o vencedor.\n` +
      `• Se alguém ficar mais de 3 minutos sem responder, chame a staff.`
    );
}

function winnerButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("w1")
        .setLabel("Venceu: Time 1")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("w2")
        .setLabel("Venceu: Time 2")
        .setStyle(ButtonStyle.Danger)
    )
  ];
}

// ==========================
// CRIAR CANAL PRIVADO
// ==========================

async function createPrivateChannel(match, guild) {
  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },

    // Jogadores
   
