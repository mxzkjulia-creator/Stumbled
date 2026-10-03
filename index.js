const {
    Client,
    GatewayIntentBits,
    Partials,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");

const fs = require("fs");

// ======================================================
// CONFIGURAÇÃO
// ======================================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const CATEGORY_ID = process.env.CATEGORY_ID;

// ======================================================
// CLIENT
// ======================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ],
    partials: [Partials.Channel]
});

// ======================================================
// ARQUIVO DE PARTIDAS
// ======================================================

const DATABASE = "./partidas.json";

let partidas = {};

if (fs.existsSync(DATABASE)) {
    try {
        partidas = JSON.parse(fs.readFileSync(DATABASE, "utf8"));
    } catch {
        partidas = {};
    }
}

function salvar() {
    fs.writeFileSync(
        DATABASE,
        JSON.stringify(partidas, null, 2)
    );
}

// ======================================================
// ID DA PARTIDA
// ======================================================

function novoId() {
    let maior = 0;

    for (const id of Object.keys(partidas)) {
        const numero = parseInt(id);

        if (!isNaN(numero) && numero > maior) {
            maior = numero;
        }
    }

    return String(maior + 1);
}

// ======================================================
// VERIFICAR STAFF
// ======================================================

function isStaff(member) {
    if (!member) return false;

    return (
        member.roles.cache.has(STAFF_ROLE_ID) ||
        member.permissions.has(PermissionFlagsBits.Administrator)
    );
}

// ======================================================
// TAMANHO DOS TIMES
// ======================================================

function tamanhoModo(modo) {
    if (modo === "1v1") return 1;
    if (modo === "2v2") return 2;
    if (modo === "3v3") return 3;

    return 1;
}

// ======================================================
// CRIAR EMBED DA PARTIDA
// ======================================================

function embedPartida(partida) {

    const time1 =
        partida.time1.length > 0
            ? partida.time1.map(id => `<@${id}>`).join("\n")
            : "Aguardando jogador...";

    const time2 =
        partida.time2.length > 0
            ? partida.time2.map(id => `<@${id}>`).join("\n")
            : "Aguardando jogador...";

    return new EmbedBuilder()
        .setTitle("🎮 Partida encontrada!")
        .setDescription(
            partida.mensagem ||
            "Entre em um dos
