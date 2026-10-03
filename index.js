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

const commands = [
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Banir um membro")
    .addUserOption(o =>
      o.setName("membro")
        .setDescription("Membro")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("motivo")
        .setDescription("Motivo")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Silenciar um membro")
    .addUserOption(o =>
      o.setName("membro")
        .setDescription("Membro")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("minutos")
        .setDescription("Tempo em minutos")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption(o =>
      o.setName("motivo")
        .setDescription("Motivo")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("expulsar")
    .setDescription("Expulsar um membro")
    .addUserOption(o =>
      o.setName("membro")
        .setDescription("Membro")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("motivo")
        .setDescription("Motivo")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("castigo")
    .setDescription("Aplicar castigo")
    .addUserOption(o =>
      o.setName("membro")
        .setDescription("Membro")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("minutos")
        .setDescription("Tempo em minutos")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption(o =>
      o.setName("motivo")
        .setDescription("Motivo")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Bloquear o canal"),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Desbloquear o canal"),

  new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Criar um embed")
    .addStringOption(o =>
      o.setName("titulo")
        .setDescription("Titulo")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("mensagem")
        .setDescription("Mensagem")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Criar painel de tickets")
];

function staff(member) {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageChannels)
  );
}

function ticketPanel() {
  const embed = new EmbedBuilder()
    .setTitle("🎫 Atendimento")
    .setDescription(
      "Selecione abaixo o motivo do seu atendimento.\n\n" +
      "📮 **Denúncias**\n" +
      "Abusos xingamentos falas inapropriadas\n\n" +
      "❓ **Dúvidas**\n" +
      "Tire dúvidas Sobre o jogo Do servidor etc\n\n" +
      "🛒 **Compra**\n" +
      ""HERE você poderá comprar W ou até mesmo Nicks coloridos após abrir o ticket a resposta será direta sobre o valor dos produtos\n\n" +
"🛡️" +
