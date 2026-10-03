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

const matches = new Map();
const INACTIVITY_MS = 180000; // 3 minutos

// =========================
// COMANDOS
// =========================

const commands = [
  new SlashCommandBuilder()
    .setName("painel")
    .setDescription("Criar painel de aposta")
    .addStringOption(o =>
      o.setName("valor")
        .setDescription("Valor da aposta")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("modo")
        .setDescription("Modo da partida")
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
      o.setName("mensagem")
        .setDescription("Nome do mapa")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("cancelar")
    .setDescription("Cancelar a partida atual")
];

const staff = member =>
  member.permissions.has(PermissionFlagsBits.ManageChannels) ||
  member.permissions.has(PermissionFlagsBits.Administrator);

// =========================
// EMBEDS
// =========================

function queueEmbed(match) {
  return new EmbedBuilder()
    .setTitle("🎯 Apostas")
    .setDescription(
      `**Mapa:** ${match.map}\n` +
      `**Modo:** ${match.mode}\n` +
      `**Plataforma:** ${match.platform}\n` +
      `**Valor:** ${match.value} por jogador\n\n` +
      `👥 **Jogadores:** ${match.players.length}/${match.maxPlayers}\n\n` +
      `Clique em **Entrar** para participar.`
    );
}

function finalEmbed(match) {
  const teamSize = Math.ceil(match.players.length / 2);

  const team1 = match.players
    .slice(0, teamSize)
    .map(id => `<@${id}>`)
    .join("\n") || "Ninguém";

  const team2 = match.players
    .slice(teamSize)
    .map(id => `<@${id}>`)
    .join("\n") || "Ninguém";

  return new EmbedBuilder()
    .setTitle("🎮 Partida encontrada!")
    .setDescription(
      `**Mapa:** ${match.map}\n` +
      `**Modo:** ${match.mode}\n` +
      `**Plataforma:** ${match.platform}\n` +
      `**Valor (por jogador):** ${match.value}\n` +
      `**Mediador:** <@${match.mediator}>\n\n` +

      `🔵 **Time 1**\n${team1}\n\n` +
      `🔴 **Time 2**\n${team2}\n\n` +

      `📜 **Regras**\n` +
      `• Joguem a partida normalmente.\n` +
      `• Enviem o print do resultado neste canal.\n` +
      `• Somente a staff pode confirmar o vencedor.\n` +
      `• Se alguém ficar mais de 3 minutos sem responder, chame a staff.`
    );
}

// =========================
// BOTÕES
// =========================

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

// =========================
// CRIAR CANAL PRIVADO
// =========================

async function createPrivateMatchChannel(match, guild) {
  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },

    // Jogadores
    ...match.players.map(id => ({
      id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    })),

    // Mediador
    {
      id: match.mediator,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
      ]
    },

    // Bot
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages
      ]
    }
  ];

  // Se você colocar STAFF_ROLE_ID nas variáveis,
  // todos desse cargo também poderão ver a partida.
  if (process.env.STAFF_ROLE_ID) {
    permissionOverwrites.push({
      id: process.env.STAFF_ROLE_ID,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
      ]
    });
  }

  const channel = await guild.channels.create({
    name: `🔒・partida-${match.mode}`,
    type: ChannelType.GuildText,
    permissionOverwrites
  });

  return channel;
}

// =========================
// REGISTRAR COMANDOS
// =========================

client.once("ready", async () => {
  console.log(`✅ Bot online como ${client.user.tag}`);

  const rest = new REST({ version: "10" })
    .setToken(process.env.DISCORD_TOKEN);

  try {
    await rest.put(
      Routes.applicationGuildCommands(
        client.user.id,
        process.env.GUILD_ID
      ),
      { body: commands.map(c => c.toJSON()) }
    );

    console.log("✅ Comandos registrados!");
  } catch (error) {
    console.error("Erro ao registrar comandos:", error);
  }
});

// =========================
// INTERAÇÕES
// =========================

client.on("interactionCreate", async interaction => {
  try {

    // =========================
    // /PAINEL
    // =========================

    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "painel"
    ) {
      if (!staff(interaction.member)) {
        return interaction.reply({
          content: "❌ Apenas staff pode usar este comando.",
          ephemeral: true
        });
      }

      const value = interaction.options.getString("valor");
      const mode = interaction.options.getString("modo");
      const platform = interaction.options.getString("plataforma");
      const map = interaction.options.getString("mensagem");

      const maxPlayers =
        mode === "1v1" ? 2 :
        mode === "2v2" ? 4 : 6;

      const match = {
        value,
        mode,
        platform,
        map,
        maxPlayers,
        players: [],
        mediator: interaction.user.id,
        queueChannelId: interaction.channel.id,
        queueMessageId: null,
        privateChannelId: null,
        timer: null
      };

      const message = await interaction.channel.send({
        embeds: [queueEmbed(match)],
        components: queueButtons()
      });

      match.queueMessageId = message.id;

      matches.set(message.id, match);

      return interaction.reply({
        content: "✅ Painel de aposta criado!",
        ephemeral: true
      });
    }

    // =========================
    // /CANCELAR
    // =========================

    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "cancelar"
    ) {
      if (!staff(interaction.member)) {
        return interaction.reply({
          content: "❌ Apenas staff pode cancelar.",
          ephemeral: true
        });
      }

      const match = [...matches.values()].find(
        m => m.privateChannelId === interaction.channel.id
      );

      if (!match) {
        return interaction.reply({
          content: "❌ Este canal não é uma partida ativa.",
          ephemeral: true
        });
      }

      await interaction.reply("🔒 Partida cancelada. Este canal será fechado.");

      matches.delete(match.queueMessageId);

      if (match.timer) {
        clearTimeout(match.timer);
      }

      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch {}
      }, 2000);

      return;
    }

    // =========================
    // BOTÕES
    // =========================

    if (interaction.isButton()) {

      const match = [...matches.values()].find(
        m =>
          m.queueMessageId === interaction.message.id ||
          m.privateChannelId === interaction.channel.id
      );

      if (!match) {
        return interaction.reply({
          content: "❌ Esta partida não está mais ativa.",
          ephemeral: true
        });
      }

      // =========================
      // ENTRAR
      // =========================

      if (interaction.customId === "join") {

        if (match.players.includes(interaction.user.id)) {
          return interaction.reply({
            content: "❌ Você já está na fila.",
            ephemeral: true
          });
        }

        if (match.players.length >= match.maxPlayers) {
          return interaction.reply({
            content: "❌ A partida já está cheia.",
            ephemeral: true
          });
        }

        match.players.push(interaction.user.id);

        // Ainda não está cheia
        if (match.players.length < match.maxPlayers) {
          return interaction.update({
            embeds: [queueEmbed(match)],
            components: queueButtons()
          });
        }

        // =========================
        // PARTIDA CHEIA
        // =========================

        await interaction.deferUpdate();

        const guild = interaction.guild;

        const privateChannel =
          await createPrivateMatchChannel(match, guild);

        match.privateChannelId = privateChannel.id;

        // Envia painel final SOMENTE no canal privado
        await privateChannel.send({
          content: match.players.map(id => `<@${id}>`).join(" "),
          embeds: [finalEmbed(match)],
          components: winnerButtons()
        });

        // Remove botões do painel antigo
        await interaction.message.edit({
          content: `✅ **Partida criada:** ${privateChannel}`,
          embeds: [queueEmbed(match)],
          components: []
        });

        // Aviso depois de 3 minutos
        match.timer = setTimeout(async () => {
          try {
            await privateChannel.send(
              "⚠️ **3 minutos se passaram.** Se algum jogador não respondeu ou não enviou o Pix, a staff pode usar `/cancelar`."
            );
          } catch {}
        }, INACTIVITY_MS);

        return;
      }

      // =========================
      // SAIR
      // =========================

      if (interaction.customId === "leave") {

        const index =
          match.players.indexOf(interaction.user.id);

        if (index === -1) {
          return interaction.reply({
            content: "❌ Você não está na fila.",
            ephemeral: true
          });
        }

        match.players.splice(index, 1);

        return interaction.update({
          embeds: [queueEmbed(match)],
          components: queueButtons()
        });
      }

      // =========================
      // VENCEDOR TIME 1
      // =========================

      if (interaction.customId === "w1") {

        if (!staff(interaction.member)) {
          return interaction.reply({
            content: "❌ Apenas staff pode votar.",
            ephemeral: true
          });
        }

        return interaction.reply({
          content: "🏆 **Time 1 venceu!**",
          allowedMentions: { parse: [] }
        });
      }

      // =========================
      // VENCEDOR TIME 2
      // =========================

      if (interaction.customId === "w2") {

        if (!staff(interaction.member)) {
          return interaction.reply({
            content: "❌ Apenas staff pode votar.",
            ephemeral: true
          });
        }

        return interaction.reply({
          content: "🏆 **Time 2 venceu!**",
          allowedMentions: { parse: [] }
        });
      }
    }

  } catch (error) {
    console.error(error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Ocorreu um erro.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// =========================
// LOGIN
// =========================

client.login(process.env.DISCORD_TOKEN);
