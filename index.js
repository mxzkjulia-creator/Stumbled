require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ChannelType,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ===============================
// CONFIGURAÇÃO
// ===============================

const comandos = [

  // BAN
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Banir um membro")
    .addUserOption(option =>
      option
        .setName("membro")
        .setDescription("Membro que será banido")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("motivo")
        .setDescription("Motivo do banimento")
        .setRequired(false)
    ),

  // MUTE
  new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Silenciar um membro")
    .addUserOption(option =>
      option
        .setName("membro")
        .setDescription("Membro que será silenciado")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("minutos")
        .setDescription("Tempo em minutos")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption(option =>
      option
        .setName("motivo")
        .setDescription("Motivo")
        .setRequired(false)
    ),

  // EXPULSAR
  new SlashCommandBuilder()
    .setName("expulsar")
    .setDescription("Expulsar um membro")
    .addUserOption(option =>
      option
        .setName("membro")
        .setDescription("Membro que será expulso")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("motivo")
        .setDescription("Motivo da expulsão")
        .setRequired(false)
    ),

  // CASTIGO
  new SlashCommandBuilder()
    .setName("castigo")
    .setDescription("Aplicar castigo a um membro")
    .addUserOption(option =>
      option
        .setName("membro")
        .setDescription("Membro")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("minutos")
        .setDescription("Duração em minutos")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption(option =>
      option
        .setName("motivo")
        .setDescription("Motivo do castigo")
        .setRequired(false)
    ),

  // LOCK
  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Bloquear o canal atual"),

  // UNLOCK
  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Desbloquear o canal atual"),

  // EMBED
  new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Enviar uma mensagem embed")
    .addStringOption(option =>
      option
        .setName("titulo")
        .setDescription("Título do embed")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("mensagem")
        .setDescription("Mensagem do embed")
        .setRequired(true)
    ),

  // TICKET
  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Criar o painel de tickets")
];

// ===============================
// FUNÇÕES
// ===============================

function isStaff(member) {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageChannels)
  );
}

function painelTicket() {
  const embed = new EmbedBuilder()
    .setTitle("🎫 Atendimento")
    .setDescription(
      "Selecione abaixo o motivo do seu atendimento.\n\n" +

      "📮 **Denúncias**\n" +
      "Abusos xingamentos falas inapropriadas\n\n" +

      "❓ **Dúvidas**\n" +
      "Tire dúvidas Sobre o jogo Do servidor etc\n\n" +

      "🛒 **Compra**\n" +
      "Aqui você poderá comprar W ou até mesmo Nicks coloridos após abrir o ticket a resposta será direta sobre o valor dos produtos\n\n" +

      "🛡️ **Suporte**\n" +
      "Caso tenha bugs no jogo ou Algo do tipo abra q iremos resolver"
    )
    .setFooter({
      text: "Selecione uma opção abaixo para abrir seu ticket."
    });

  const menu = new StringSelectMenuBuilder()
    .setCustomId("abrir_ticket")
    .setPlaceholder("Selecione o motivo do atendimento")
    .addOptions(
      {
        label: "Denúncias",
        description: "Denúncias, abusos e xingamentos",
        value: "denuncias",
        emoji: "📮"
      },
      {
        label: "Dúvidas",
        description: "Tire suas dúvidas",
        value: "duvidas",
        emoji: "❓"
      },
      {
        label: "Compra",
        description: "Compras e nicks coloridos",
        value: "compra",
        emoji: "🛒"
      },
      {
        label: "Suporte",
        description: "Bugs e problemas",
        value: "suporte",
        emoji: "🛡️"
      }
    );

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(menu)
    ]
  };
}

function botoesTicket() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("fechar_ticket")
        .setLabel("Fechar")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId("painel_staff")
        .setLabel("Painel Staff")
        .setEmoji("🛡️")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("painel_membro")
        .setLabel("Painel Membro")
        .setEmoji("👤")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function painelStaff() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("adicionar_membro")
      .setLabel("Adicionar membro")
      .setEmoji("➕")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("retirar_membro")
      .setLabel("Retirar membro")
      .setEmoji("➖")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("notificar_membro")
      .setLabel("Notificar membro")
      .setEmoji("🔔")
      .setStyle(ButtonStyle.Primary)
  );
}

function painelMembro() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("notificar_staff")
      .setLabel("Notificar staff")
      .setEmoji("🔔")
      .setStyle(ButtonStyle.Primary)
  );
}

function nomeMotivo(motivo) {
  const nomes = {
    denuncias: "Denúncias",
    duvidas: "Dúvidas",
    compra: "Compra",
    suporte: "Suporte"
  };

  return nomes[motivo] || "Atendimento";
}

// ===============================
// BOT ONLINE
// ===============================

client.once("ready", async () => {
  console.log(`✅ BOT ONLINE: ${client.user.tag}`);

  try {
    const rest = new REST({ version: "10" })
      .setToken(process.env.DISCORD_TOKEN);

    await rest.put(
      Routes.applicationGuildCommands(
        client.user.id,
        process.env.GUILD_ID
      ),
      {
        body: comandos.map(command => command.toJSON())
      }
    );

    console.log("✅ COMANDOS REGISTRADOS!");
  } catch (erro) {
    console.error("❌ ERRO AO REGISTRAR COMANDOS:", erro);
  }
});

// ===============================
// INTERAÇÕES
// ===============================

client.on("interactionCreate", async interaction => {

  try {

    // =================================
    // COMANDOS
    // =================================

    if (interaction.isChatInputCommand()) {

      // -------------------------------
      // BAN
      // -------------------------------

      if (interaction.commandName === "ban") {

        if (!isStaff(interaction.member)) {
          return interaction.reply({
            content: "❌ Apenas staff pode usar este comando.",
            ephemeral: true
          });
        }

        const membro = interaction.options.getMember("membro");
        const motivo =
          interaction.options.getString("motivo") ||
          "Nenhum motivo informado.";

        if (!membro) {
          return interaction.reply({
            content: "❌ Não encontrei esse membro.",
            ephemeral: true
          });
        }

        if (!membro.bannable) {
          return interaction.reply({
            content: "❌ Não posso banir esse membro.",
            ephemeral: true
          });
        }

        await membro.ban({ reason: motivo });

        return interaction.reply(
          `🔨 **${membro.user.tag}** foi banido.\n**Motivo:** ${motivo}`
        );
      }

      // -------------------------------
      // MUTE
      // -------------------------------

      if (interaction.commandName === "mute") {

        if (!isStaff(interaction.member)) {
          return interaction.reply({
            content: "❌ Apenas staff pode usar este comando.",
            ephemeral: true
          });
        }

        const membro = interaction.options.getMember("membro");
        const minutos = interaction.options.getInteger("minutos");
        const motivo =
          interaction.options.getString("motivo") ||
          "Nenhum motivo informado.";

        if (!membro) {
          return interaction.reply({
            content: "❌ Não encontrei esse membro.",
            ephemeral: true
          });
        }

        if (!membro.moderatable) {
          return interaction.reply({
            content: "❌ Não posso silenciar esse membro
