require("dotenv").config();

const {
  Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes,
  PermissionFlagsBits, ChannelType, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const filas = new Map();
const partidas = new Map();

const commands = [
  new SlashCommandBuilder()
    .setName("painel")
    .setDescription("Criar painel de aposta")
    .addStringOption(o =>
      o.setName("valor").setDescription("Valor").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("modo").setDescription("Modo").setRequired(true)
        .addChoices(
          { name: "1v1", value: "1v1" },
          { name: "2v2", value: "2v2" },
          { name: "3v3", value: "3v3" }
        )
    )
    .addStringOption(o =>
      o.setName("plataforma").setDescription("Plataforma").setRequired(true)
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

const staff = m =>
  m.permissions.has(PermissionFlagsBits.Administrator) ||
  m.permissions.has(PermissionFlagsBits.ManageChannels);

const filaBotoes = () => [
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

const vencedorBotoes = () => [
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

function partidaEmbed(m) {
  const meio = Math.ceil(m.jogadores.length / 2);

  const time1 = m.jogadores
    .slice(0, meio)
    .map(x => `<@${x}>`)
    .join("\n");

  const time2 = m.jogadores
    .slice(meio)
    .map(x => `<@${x}>`)
    .join("\n");

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
      `• Joguem normalmente.\n` +
      `• Enviem o print do resultado aqui.\n` +
      `• Somente staff confirma o vencedor.\n` +
      `• Após 3 minutos sem resposta, chame a staff.`
    );
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

  return guild.channels.create({
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
      body: commands.map(x => x.toJSON())
    }
  );

  console.log("✅ Comandos registrados!");
});

client.on("interactionCreate", async i => {
  try {

    if (i.isChatInputCommand() && i.commandName === "painel") {
      if (!staff(i.member)) {
        return i.reply({
          content: "❌ Apenas staff pode usar.",
          ephemeral: true
        });
      }

      const modo = i.options.getString("modo");

      const m = {
        valor: i.options.getString("valor"),
        modo,
        plataforma: i.options.getString("plataforma"),
        mapa: i.options.getString("mensagem"),
        max: modo === "1v1" ? 2 : modo === "2v2" ? 4 : 6,
        jogadores: [],
        mediador: i.user.id
      };

      const msg = await i.channel.send({
        embeds: [filaEmbed(m)],
        components: filaBotoes()
      });

      filas.set(msg.id, m);

      return i.reply({
        content: "✅ Painel criado!",
        ephemeral: true
      });
    }

    if (i.isChatInputCommand() && i.commandName === "cancelar") {
      if (!staff(i.member)) {
        return i.reply({
          content: "❌ Apenas staff pode cancelar.",
          ephemeral: true
        });
      }

      const m = partidas.get(i.channel.id);

      if (!m) {
        return i.reply({
          content: "❌ Este canal não é uma partida.",
          ephemeral: true
        });
      }

      await i.reply("🔒 Partida cancelada. Fechando...");

      partidas.delete(i.channel.id);

      setTimeout(() => {
        i.channel.delete().catch(() => {});
      }, 1500);

      return;
    }

    if (!i.isButton()) return;

    if (i.customId === "entrar" || i.customId === "sair") {
      const m = filas.get(i.message.id);

      if (!m) {
        return i.reply({
          content: "❌ Esta fila não está mais ativa.",
          ephemeral: true
        });
      }

      const id = String(i.user.id);

      if (i.customId === "entrar") {
        if (m.jogadores.includes(id)) {
          return i.reply({
            content: "❌ Você já está na fila.",
            ephemeral: true
          });
        }

        if (m.jogadores.length >= m.max) {
          return i.reply({
            content: "❌ A partida já está cheia.",
            ephemeral: true
          });
        }

        m.jogadores.push(id);

        if (m.jogadores.length < m.max) {
          return i.update({
            embeds: [filaEmbed(m)],
            components: filaBotoes()
          });
        }

        await i.deferUpdate();

        const canal = await criarPartida(m, i.guild);

        partidas.set(canal.id, m);

        await canal.send({
          content: m.jogadores.map(x => `<@${x}>`).join(" "),
          embeds: [partidaEmbed(m)],
          components: vencedorBotoes()
        });

        await i.message.edit({
          content: `✅ Partida criada: ${canal}`,
          embeds: [],
          components: []
        });

        filas.delete(i.message.id);

        return;
      }

      const pos = m.jogadores.indexOf(id);

      if (pos < 0) {
        return i.reply({
          content: "❌ Você não está na fila.",
          ephemeral: true
        });
      }

      m.jogadores.splice(pos, 1);

      return i.update({
        embeds: [filaEmbed(m)],
        components: filaBotoes()
      });
    }

    if (i.customId === "time1" || i.customId === "time2") {
      if (!staff(i.member)) {
        return i.reply({
          content: "❌ Apenas staff pode votar.",
          ephemeral: true
        });
      }

      const vencedor =
        i.customId === "time1" ? "Time 1" : "Time 2";

      return i.reply(`🏆 **${vencedor} venceu!**`);
    }

  } catch (e) {
    console.error(e);

    if (!i.replied && !i.deferred) {
      i.reply({
        content: "❌ Ocorreu um erro.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
