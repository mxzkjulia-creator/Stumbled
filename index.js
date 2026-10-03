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
      o.setName("valor")
        .setDescription("Valor da aposta")
        .setRequired(true)
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
      o.setName("mensagem")
        .setDescription("Mapa")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("cancelar")
    .setDescription("Cancelar partida")
];

function isStaff(member) {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageChannels)
  );
}

function limite(modo) {
  if (modo === "1v1") return 2;
  if (modo === "2v2") return 4;
  return 6;
}

function painelEmbed(m) {
  return new EmbedBuilder()
    .setTitle("🎯 Apostas")
    .setDescription(
      `**Mapa:** ${m.mapa}\n` +
      `**Modo:** ${m.modo}\n` +
      `**Plataforma:** ${m.plataforma}\n` +
      `**Valor:** ${m.valor} por jogador\n\n` +
      `👥 **Jogadores:** ${m.jogadores.size}/${m.max}\n\n` +
      `Clique em **Entrar** para participar.`
    );
}

function botoesFila() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("entrar_aposta")
        .setLabel("Entrar")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("sair_aposta")
        .setLabel("Sair")
        .setEmoji("❌")
        .setStyle(ButtonStyle.Danger)
    )
  ];
}

function botoesVencedor() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("vencedor_time1")
        .setLabel("Venceu: Time 1")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("vencedor_time2")
        .setLabel("Venceu: Time 2")
        .setStyle(ButtonStyle.Danger)
    )
  ];
}

function partidaEmbed(m) {
  const jogadores = [...m.jogadores.keys()];

  const metade = Math.ceil(jogadores.length / 2);

  const time1 = jogadores
    .slice(0, metade)
    .map(id => `<@${id}>`)
    .join("\n");

  const time2 = jogadores
    .slice(metade)
    .map(id => `<@${id}>`)
    .join("\n");

  return new EmbedBuilder()
    .setTitle("🎮 Partida encontrada!")
    .setDescription(
      `**Mapa:** ${m.mapa}\n` +
      `**Modo:** ${m.modo}\n` +
      `**Plataforma:** ${m.plataforma}\n` +
      `**Valor (por jogador):** ${m.valor}\n` +
      `**Mediador:** <@${m.mediador}>\n\n` +

      `🔵 **Time 1**\n` +
      `${time1 || "Nenhum"}\n\n` +

      `🔴 **Time 2**\n` +
      `${time2 || "Nenhum"}\n\n` +

      `📜 **Regras**\n` +
      `• Joguem a partida normalmente.\n` +
      `• Enviem o print do resultado aqui.\n` +
      `• Somente a staff pode confirmar o vencedor.\n` +
      `• Se alguém ficar 3 minutos sem responder, chame a staff.`
    );
}

async function criarCanalPartida(m, guild) {
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

  for (const id of m.jogadores.keys()) {
    permissoes.push({
      id: id,
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
  console.log(`✅ BOT ONLINE: ${client.user.tag}`);

  const rest = new REST({ version: "10" })
    .setToken(process.env.DISCORD_TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(
      client.user.id,
      process.env.GUILD_ID
    ),
    {
      body: comandos.map(c => c.toJSON())
    }
  );

  console.log("✅ COMANDOS REGISTRADOS!");
});

client.on("interactionCreate", async interaction => {
  try {

    // =========================
    // /PAINEL
    // =========================

    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "painel"
    ) {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "❌ Apenas staff pode usar este comando.",
          ephemeral: true
        });
      }

      const modo = interaction.options.getString("modo");

      const aposta = {
        valor: interaction.options.getString("valor"),
        modo: modo,
        plataforma: interaction.options.getString("plataforma"),
        mapa: interaction.options.getString("mensagem"),
        max: limite(modo),

        // MAPA DE JOGADORES
        jogadores: new Map(),

        mediador: interaction.user.id
      };

      const mensagem = await interaction.channel.send({
        embeds: [painelEmbed(aposta)],
        components: botoesFila()
      });

      filas.set(mensagem.id, aposta);

      return interaction.reply({
        content: "✅ Painel criado!",
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
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "❌ Apenas staff pode cancelar.",
          ephemeral: true
        });
      }

      const partida = partidas.get(interaction.channel.id);

      if (!partida) {
        return interaction.reply({
          content: "❌ Este canal não é uma partida ativa.",
          ephemeral: true
        });
      }

      await interaction.reply(
        "🔒 Partida cancelada. O canal será fechado."
      );

      partidas.delete(interaction.channel.id);

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 1500);

      return;
    }

    if (!interaction.isButton()) return;

    // =========================
    // ENTRAR
    // =========================

    if (interaction.customId === "entrar_aposta") {

      const aposta = filas.get(interaction.message.id);

      if (!aposta) {
        return interaction.reply({
          content: "❌ Esta fila não está mais ativa.",
          ephemeral: true
        });
      }

      // ID REAL DE QUEM CLICOU
      const jogadorId = interaction.user.id;

      console.log(
        `🟢 BOTÃO ENTRAR: ${interaction.user.username} | ID: ${jogadorId}`
      );

      // VERIFICA SOMENTE O ID DO USUÁRIO
      if (aposta.jogadores.has(jogadorId)) {
        return interaction.reply({
          content: "❌ Você já está na fila.",
          ephemeral: true
        });
      }

      if (aposta.jogadores.size >= aposta.max) {
        return interaction.reply({
          content: "❌ A partida já está cheia.",
          ephemeral: true
        });
      }

      // ADICIONA O USUÁRIO
      aposta.jogadores.set(
        jogadorId,
        interaction.user.username
      );

      console.log(
        `✅ ENTROU: ${interaction.user.username}`
      );

      console.log(
        `👥 JOGADORES:`,
        [...aposta.jogadores.entries()]
      );

      // AINDA NÃO ENCHEU
      if (aposta.jogadores.size < aposta.max) {
        return interaction.update({
          embeds: [painelEmbed(aposta)],
          components: botoesFila()
        });
      }

      // =========================
      // PARTIDA CHEIA
      // =========================

      await interaction.deferUpdate();

      const canal = await criarCanalPartida(
        aposta,
        interaction.guild
      );

      partidas.set(canal.id, aposta);

      const jogadores = [...aposta.jogadores.keys()];

      await canal.send({
        content: jogadores
          .map(id => `<@${id}>`)
          .join(" "),

        embeds: [partidaEmbed(aposta)],

        components: botoesVencedor()
      });

      await interaction.message.edit({
        content: `✅ **Partida criada:** ${canal}`,
        embeds: [],
        components: []
      });

      filas.delete(interaction.message.id);

      return;
    }

    // =========================
    // SAIR
    // =========================

    if (interaction.customId === "sair_aposta") {

      const aposta = filas.get(interaction.message.id);

      if (!aposta) {
        return interaction.reply({
          content: "❌ Esta fila não está mais ativa.",
          ephemeral: true
        });
      }

      const jogadorId = interaction.user.id;

      if (!aposta.jogadores.has(jogadorId)) {
        return interaction.reply({
          content: "❌ Você não está na fila.",
          ephemeral: true
        });
      }

      aposta.jogadores.delete(jogadorId);

      return interaction.update({
        embeds: [painelEmbed(aposta)],
        components: botoesFila()
      });
    }

    // =========================
    // VENCEDOR TIME 1
    // =========================

    if (interaction.customId === "vencedor_time1") {

      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "❌ Apenas staff pode votar.",
          ephemeral: true
        });
      }

      return interaction.reply(
        "🏆 **Time 1 venceu!**"
      );
    }

    // =========================
    // VENCEDOR TIME 2
    // =========================

    if (interaction.customId === "vencedor_time2") {

      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "❌ Apenas staff pode votar.",
          ephemeral: true
        });
      }

      return interaction.reply(
        "🏆 **Time 2 venceu!**"
      );
    }

  } catch (erro) {

    console.error("❌ ERRO:", erro);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Ocorreu um erro no bot.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
