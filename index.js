require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
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

const filas = new Map();
const partidas = new Map();

const comandos = [
  new SlashCommandBuilder()
    .setName("painel")
    .setDescription("Criar painel de aposta")
    .addStringOption(o =>
      o.setName("valor").setDescription("Valor da aposta").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("modo")
        .setDescription("Modo")
        .setRequired(true)
        .addChoices(
          { name: "1v1", value: "1v1" },
          { name: "2v2", value: "2v2" },
          { name: "3v3", value: "3v3" }
        )
    )
    .addStringOption(o =>
      o.setName("plataforma")
        .setDescription("Plataforma")
        .setRequired(true)
        .addChoices(
          { name: "PC", value: "PC" },
          { name: "Mobile", value: "Mobile" },
          { name: "Misto", value: "Misto" }
        )
    )
    .addStringOption(o =>
      o.setName("mensagem").setDescription("Mapa").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("cancelar")
    .setDescription("Cancelar partida")
];

function staff(m) {
  return (
    m.permissions.has(PermissionFlagsBits.Administrator) ||
    m.permissions.has(PermissionFlagsBits.ManageChannels)
  );
}

function filaEmbed(m) {
  return new EmbedBuilder()
    .setTitle("🎯 Apostas")
    .setDescription(
      `**Mapa:** ${m.mapa}\n` +
      `**Modo:** ${m.modo}\n` +
      `**Plataforma:** ${m.plataforma}\n` +
      `**Valor:** ${m.valor} por jogador\n\n` +
      `👥 **Jogadores:** ${m.jogadores.length}/${m.max}\n\n` +
      `Clique em **Entrar** para participar.`
    );
}

function filaBotoes() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("entrar")
        .setLabel("Entrar")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("sair")
        .setLabel("Sair")
        .setEmoji("❌")
        .setStyle(ButtonStyle.Danger)
    )
  ];
}

function partidaEmbed(m) {
  const meio = Math.ceil(m.jogadores.length / 2);
  const time1 = m.jogadores.slice(0, meio).map(x => `<@${x}>`).join("\n");
  const time2 = m.jogadores.slice(meio).map(x => `<@${x}>`).join("\n");

  return new EmbedBuilder()
    .setTitle("🎮 Partida encontrada!")
    .setDescription(
      `**Mapa:** ${m.mapa}\n` +
      `**Modo:** ${m.modo}\n` +
      `**Plataforma:** ${m.plataforma}\n` +
      `**Valor (por jogador):** ${m.valor}\n` +
      `**Mediador:** <@${m.mediador}>\n\n` +
      `🔵 **Time 1**\n${time1}\n\n` +
      `🔴 **Time 2**\n${time2}\n\n` +
      `📜 **Regras**\n` +
      `• Joguem a partida normalmente.\n` +
      `• Enviem o print do resultado aqui.\n` +
      `• Somente a staff pode confirmar o vencedor.\n` +
      `• Se alguém ficar 3 minutos sem responder, chame a staff.`
    );
}

function vencedorBotoes() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("time1")
        .setLabel("Venceu: Time 1")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("time2")
        .setLabel("Venceu: Time 2")
        .setStyle(ButtonStyle.Danger)
    )
  ];
}

async function criarPartida(m, guild) {
  const permissoes = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: m.mediador,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels
      ]
    }
  ];

  for (const id of m.jogadores) {
    permissoes.push({
      id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  return await guild.channels.create({
    name: `🔒・partida-${m.modo}`,
    type: ChannelType.GuildText,
    permissionOverwrites: permissoes
  });
}

client.once("ready", async () => {
  console.log(`✅ Bot online: ${client.user.tag}`);

  const rest = new REST({ version: "10" })
    .setToken(process.env.DISCORD_TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(
      client.user.id,
      process.env.GUILD_ID
    ),
    {
      body: comandos.map
