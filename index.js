const {
    Client,
    GatewayIntentBits,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");

const fs = require("fs");

// ===============================
// CONFIGURAÇÃO
// ===============================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const CATEGORY_ID = process.env.CATEGORY_ID;

// ===============================
// BOT
// ===============================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

// ===============================
// BANCO DE DADOS
// ===============================

const arquivo = "./partidas.json";

let partidas = {};

if (fs.existsSync(arquivo)) {
    try {
        partidas = JSON.parse(
            fs.readFileSync(arquivo, "utf8")
        );
    } catch {
        partidas = {};
    }
}

function salvar() {
    fs.writeFileSync(
        arquivo,
        JSON.stringify(partidas, null, 2)
    );
}

// ===============================
// TAMANHO DO MODO
// ===============================

function tamanhoTime(modo) {
    if (modo === "1v1") return 1;
    if (modo === "2v2") return 2;
    if (modo === "3v3") return 3;
    return 1;
}

// ===============================
// STAFF
// ===============================

function staff(member) {
    if (!member) return false;

    return (
        member.permissions.has(
            PermissionFlagsBits.Administrator
        ) ||
        member.roles.cache.has(STAFF_ROLE_ID)
    );
}

// ===============================
// EMBED DA PARTIDA
// ===============================

function partidaEmbed(p) {

    const time1 =
        p.time1.length
            ? p.time1.map(x => `<@${x}>`).join("\n")
            : "Aguardando jogador...";

    const time2 =
        p.time2.length
            ? p.time2.map(x => `<@${x}>`).join("\n")
            : "Aguardando jogador...";

    return new EmbedBuilder()
        .setTitle("🎮 APOSTA / PARTIDA")
        .setDescription(
            p.mensagem ||
            "Entre em um dos times abaixo."
        )
        .addFields(
            {
                name: "💰 Valor",
                value: `R$ ${p.valor}`,
                inline: true
            },
            {
                name: "🎮 Modo",
                value: p.modo,
                inline: true
            },
            {
                name: "🖥️ Plataforma",
                value: p.plataforma,
                inline: true
            },
            {
                name: "🔵 TIME 1",
                value: time1,
                inline: true
            },
            {
                name: "🔴 TIME 2",
                value: time2,
                inline: true
            }
        )
        .setFooter({
            text: `Partida #${p.id}`
        });
}

// ===============================
// BOTÕES DA PARTIDA
// ===============================

function botoesPartida(id) {

    return new ActionRowBuilder()
        .addComponents(

            new ButtonBuilder()
                .setCustomId(`time1_${id}`)
                .setLabel("Entrar no Time 1")
                .setEmoji("🔵")
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId(`time2_${id}`)
                .setLabel("Entrar no Time 2")
                .setEmoji("🔴")
                .setStyle(ButtonStyle.Danger)

        );
}

// ===============================
// BOT ONLINE
// ===============================

client.once("ready", async () => {

    console.log(
        `✅ Bot online: ${client.user.tag}`
    );

    try {

        const guild =
            await client.guilds.fetch(GUILD_ID);

        await guild.commands.set([

            {
                name: "painel",
                description:
                    "Abrir painel de partidas"
            },

            {
                name: "staff",
                description:
                    "Abrir painel da Staff"
            },

            {
                name: "cancelar",
                description:
                    "Cancelar uma partida",
                options: [
                    {
                        name: "partida",
                        description:
                            "Número da partida",
                        type: 3,
                        required: true
                    }
                ]
            }

        ]);

        console.log("✅ Comandos registrados!");

    } catch (erro) {

        console.log(
            "❌ Erro registrando comandos:",
            erro
        );

    }

});

// ===============================
// INTERAÇÕES
// ===============================

client.on(
    "interactionCreate",
    async interaction => {

        // ===========================
        // /PAINEL
        // ===========================

        if (
            interaction.isChatInputCommand() &&
            interaction.commandName === "painel"
        ) {

            const botao =
                new ButtonBuilder()
                    .setCustomId("criar")
                    .setLabel("Criar partida")
                    .setEmoji("🎮")
                    .setStyle(
                        ButtonStyle.Success
                    );

            const row =
                new ActionRowBuilder()
                    .addComponents(botao);

            const embed =
                new EmbedBuilder()
                    .setTitle(
                        "🎮 PAINEL DE PARTIDAS"
                    )
                    .setDescription(
                        "Clique em **Criar partida** para abrir uma nova partida."
                    );

            await interaction.reply({
                embeds: [embed],
                components: [row]
            });

            return;
        }

        // ===========================
        // /STAFF
        // ===========================

        if (
            interaction.isChatInputCommand() &&
            interaction.commandName === "staff"
        ) {

            if (!staff(interaction.member)) {

                await interaction.reply({
                    content:
                        "❌ Apenas Staffs podem usar este comando.",
                    ephemeral: true
                });

                return;
            }

            const lista =
                Object.values(partidas)
                    .filter(
                        p =>
                            p.status ===
                            "aguardando" ||
                            p.status ===
                            "andamento"
                    );

            if (!lista.length) {

                await interaction.reply({
                    content:
                        "📭 Não existem partidas ativas.",
                    ephemeral: true
                });

                return;
            }

            const opcoes =
                lista.slice(0, 25).map(p => ({
                    label:
                        `Partida #${p.id} - ${p.modo}`,
                    description:
                        `${p.time1.length + p.time2.length} jogadores`,
                    value: p.id
                }));

            const menu =
                new StringSelectMenuBuilder()
                    .setCustomId(
                        "staff_partida"
                    )
                    .setPlaceholder(
                        "Escolha uma partida"
                    )
                    .addOptions(opcoes);

            await interaction.reply({
                content:
                    "👮 **PAINEL STAFF**\nEscolha uma partida:",
                components: [
                    new ActionRowBuilder()
                        .addComponents(menu)
                ],
                ephemeral: true
            });

            return;
        }

        // ===========================
        // /CANCELAR
        // ===========================

        if (
            interaction.isChatInputCommand() &&
            interaction.commandName === "cancelar"
        ) {

            if (!staff(interaction.member)) {

                await interaction.reply({
                    content:
                        "❌ Apenas Staffs podem usar este comando.",
                    ephemeral: true
                });

                return;
            }

            const id =
                interaction.options.getString(
                    "partida"
                );

            const p = partidas[id];

            if (!p) {

                await interaction.reply({
                    content:
                        "❌ Partida não encontrada.",
                    ephemeral: true
                });

                return;
            }

            p.status = "cancelada";

            salvar();

            if (p.channelId) {

                const canal =
                    interaction.guild.channels.cache.get(
                        p.channelId
                    );

                if (canal) {

                    await canal.send(
                        "❌ **Partida cancelada pela Staff.**"
                    );

                    setTimeout
