const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ChannelType,
    PermissionsBitField,
    Events,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder,
    AttachmentBuilder
} = require('discord.js');
const fs = require('fs');

// ===============================
// USTAWIENIA
// ===============================

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
    console.error('❌ Brak zmiennej środowiskowej DISCORD_TOKEN.');
    process.exit(1);
}
const GUILD_ID = '1537809849742524497';

const TICKET_CATEGORY_ID = '1537809852695453838';

const LOG_CHANNEL_ID = '1538335150042124379';

const TRANSCRIPT_CHANNEL_ID = '1538335911346049064';

// ===============================
// BOT
// ===============================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ===============================
// START
// ===============================

client.once(Events.ClientReady, async () => {

    console.log(`BOT DZIAŁA: ${client.user.tag}`);

    const command = new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Otwiera panel ticketów');

    const rest = new REST({ version: '10' })
        .setToken(TOKEN);

    try {

        await rest.put(
            Routes.applicationGuildCommands(
                client.user.id,
                GUILD_ID
            ),
            {
                body: [command.toJSON()]
            }
        );

        console.log('KOMENDA /ticket GOTOWA');

    } catch (error) {

        console.error('BŁĄD KOMENDY:', error);

    }
});

// ===============================
// INTERAKCJE
// ===============================

client.on(Events.InteractionCreate, async interaction => {

    // ===========================
    // /ticket
    // ===========================

    if (interaction.isChatInputCommand()) {

        if (interaction.commandName !== 'ticket')
            return;

        const menu =
            new StringSelectMenuBuilder()
                .setCustomId('ticket_type')
                .setPlaceholder('🎫 Wybierz typ ticketa')
                .addOptions(

                    new StringSelectMenuOptionBuilder()
                        .setLabel('Pomoc')
                        .setDescription('Potrzebujesz pomocy')
                        .setEmoji('🛠️')
                        .setValue('pomoc'),

                    new StringSelectMenuOptionBuilder()
                        .setLabel('Zakup')
                        .setDescription('Sprawa dotycząca zakupu')
                        .setEmoji('💰')
                        .setValue('zakup'),

                    new StringSelectMenuOptionBuilder()
                        .setLabel('Zgłoszenie')
                        .setDescription('Zgłoś gracza lub problem')
                        .setEmoji('🚨')
                        .setValue('zgloszenie'),

                    new StringSelectMenuOptionBuilder()
                        .setLabel('Inne')
                        .setDescription('Inna sprawa')
                        .setEmoji('❓')
                        .setValue('inne')
                );

        const row =
            new ActionRowBuilder()
                .addComponents(menu);

        await interaction.reply({

            embeds: [

                new EmbedBuilder()
                    .setTitle('🎫 Centrum pomocy')
                    .setDescription(
                        '**Wybierz typ ticketa**\n\n' +
                        'Wybierz odpowiednią opcję poniżej.'
                    )

            ],

            components: [row]

        });

        return;
    }

    // ===========================
    // WYBÓR TYPU
    // ===========================

    if (interaction.isStringSelectMenu()) {

        if (interaction.customId !== 'ticket_type')
            return;

        try {

            await interaction.deferReply({
                ephemeral: true
            });

            const type = interaction.values[0];

            const names = {

                pomoc: '🛠️┆pomoc',

                zakup: '💰┆zakup',

                zgloszenie: '🚨┆zgloszenie',

                inne: '❓┆inne'

            };

            const existing =
                interaction.guild.channels.cache.find(
                    channel =>
                        channel.topic ===
                        `ticket-${interaction.user.id}`
                );

            if (existing) {

                await interaction.editReply(
                    `❌ Masz już otwarty ticket: ${existing}`
                );

                return;
            }

            // ===========================
            // TWORZENIE KANAŁU
            // ===========================

            const channel =
                await interaction.guild.channels.create({

                    name:
                        `${names[type]}-${interaction.user.username}`,

                    type:
                        ChannelType.GuildText,

                    parent:
                        TICKET_CATEGORY_ID,

                    topic:
                        `ticket-${interaction.user.id}`,

                    permissionOverwrites: [

                        {
                            id:
                                interaction.guild.id,

                            deny: [
                                PermissionsBitField.Flags.ViewChannel
                            ]

                        },

                        {
                            id:
                                interaction.user.id,

                            allow: [

                                PermissionsBitField.Flags.ViewChannel,

                                PermissionsBitField.Flags.SendMessages,

                                PermissionsBitField.Flags.ReadMessageHistory

                            ]

                        },

                        {
                            id:
                                client.user.id,

                            allow: [

                                PermissionsBitField.Flags.ViewChannel,

                                PermissionsBitField.Flags.SendMessages,

                                PermissionsBitField.Flags.ReadMessageHistory,

                                PermissionsBitField.Flags.ManageChannels

                            ]

                        }

                    ]

                });

            // ===========================
            // NAD OTWÓRZ-TICKET
            // ===========================

            const openChannel =
                interaction.guild.channels.cache.find(
                    ch =>
                        ch.parentId === TICKET_CATEGORY_ID &&
                        ch.name === '📤┆otwórz-ticket'
                );

            if (openChannel) {

                await channel.setPosition(
                    openChannel.position
                );

            }

            // ===========================
            // PRZYCISKI
            // ===========================

            const claimButton =
                new ButtonBuilder()

                    .setCustomId('claim_ticket')

                    .setLabel('Przejmij')

                    .setEmoji('🙋')

                    .setStyle(ButtonStyle.Primary);

            const closeButton =
                new ButtonBuilder()

                    .setCustomId('close_ticket')

                    .setLabel('Zamknij')

                    .setEmoji('🔒')

                    .setStyle(ButtonStyle.Danger);

            const buttons =
                new ActionRowBuilder()
                    .addComponents(
                        claimButton,
                        closeButton
                    );

            // ===========================
            // POWITANIE
            // ===========================

            await channel.send({

                content:
                    `👋 **Witaj ${interaction.user}!**\n\n` +

                    `🎫 Twój ticket został utworzony.\n\n` +

                    `📂 **Typ:** ${names[type]}\n` +

                    `📝 Opisz dokładnie swoją sprawę.\n` +

                    `🙋 Członek supportu może przejąć ten ticket.\n\n` +

                    `🔒 Po zakończeniu sprawy użyj przycisku **Zamknij**.`,

                components: [buttons]

            });

            // ===========================
            // LOG OTWARCIA
            // ===========================

            const logChannel =
                interaction.guild.channels.cache.get(
                    LOG_CHANNEL_ID
                );

            if (logChannel) {

                const embed =
                    new EmbedBuilder()

                        .setTitle('🎫 Ticket otwarty')

                        .addFields(

                            {
                                name: '👤 Autor',
                                value: `${interaction.user}`,
                                inline: true
                            },

                            {
                                name: '📂 Typ',
                                value: names[type],
                                inline: true
                            },

                            {
                                name: '📌 Kanał',
                                value: `${channel}`,
                                inline: true
                            }

                        )

                        .setTimestamp();

                await logChannel.send({
                    embeds: [embed]
                });

            }

            await interaction.editReply(
                `✅ Ticket został utworzony: ${channel}`
            );

        } catch (error) {

            console.error(
                '❌ BŁĄD TWORZENIA TICKETA:',
                error
            );

            if (interaction.deferred) {

                await interaction.editReply(
                    '❌ Nie udało się utworzyć ticketu. Sprawdź konsolę bota.'
                ).catch(() => {});

            }

        }

        return;
    }

    // ===========================
    // PRZEJĘCIE TICKETA
    // ===========================

    if (interaction.isButton()) {

        if (interaction.customId === 'claim_ticket') {

            await interaction.reply({

                content:
                    `🙋 Ticket został przejęty przez ${interaction.user}.`,

                ephemeral: false

            });

            return;
        }

        // ===========================
        // ZAMKNIĘCIE
        // ===========================

        if (interaction.customId === 'close_ticket') {

            const confirmButton =
                new ButtonBuilder()

                    .setCustomId('confirm_close')

                    .setLabel('Tak, zamknij')

                    .setEmoji('🔴')

                    .setStyle(ButtonStyle.Danger);

            const cancelButton =
                new ButtonBuilder()

                    .setCustomId('cancel_close')

                    .setLabel('Anuluj')

                    .setEmoji('⚪')

                    .setStyle(ButtonStyle.Secondary);

            const row =
                new ActionRowBuilder()
                    .addComponents(
                        confirmButton,
                        cancelButton
                    );

            await interaction.reply({

                content:
                    '⚠️ **Czy na pewno chcesz zamknąć ten ticket?**',

                components: [row]

            });

            return;
        }

        // ===========================
        // ANULOWANIE
        // ===========================

        if (interaction.customId === 'cancel_close') {

            await interaction.update({

                content:
                    '✅ Anulowano zamykanie ticketu.',

                components: []

            });

            return;
        }

        // ===========================
        // POTWIERDZENIE
        // ===========================

        if (interaction.customId === 'confirm_close') {

            const channel = interaction.channel;

            await interaction.update({

                content:
                    '🔒 Ticket zostanie zamknięty za 5 sekund.',

                components: []

            });

            // ===========================
            // TRANSCRIPT
            // ===========================

            try {

                let messages = [];

                let lastId;

                while (true) {

                    const fetched =
                        await channel.messages.fetch({

                            limit: 100,

                            before: lastId

                        });

                    if (fetched.size === 0)
                        break;

                    messages.push(
                        ...fetched.values()
                    );

                    lastId =
                        fetched.last().id;

                    if (fetched.size < 100)
                        break;
                }

                messages.reverse();

                let transcript =
                    `TRANSCRIPT: ${channel.name}\n`;

                transcript +=
                    `DATA: ${new Date().toLocaleString()}\n\n`;

                for (const message of messages) {

                    transcript +=
                        `[${message.createdAt.toLocaleString()}] ` +

                        `${message.author.tag}: ` +

                        `${message.content}\n`;

                }

                const fileName =
                    `${channel.name}-transcript.txt`;

                fs.writeFileSync(
                    fileName,
                    transcript
                );

                const transcriptChannel =
                    interaction.guild.channels.cache.get(
                        TRANSCRIPT_CHANNEL_ID
                    );

                if (transcriptChannel) {

                    await transcriptChannel.send({

                        content:
                            `💾 **Transcript ticketu:** ${channel.name}\n` +

                            `🔒 Zamknął: ${interaction.user}`,

                        files: [
                            new AttachmentBuilder(
                                fileName
                            )
                        ]

                    });

                }

                fs.unlinkSync(fileName);

            } catch (error) {

                console.error(
                    '❌ BŁĄD TRANSCRIPTU:',
                    error
                );

            }

            // ===========================
            // LOG ZAMKNIĘCIA
            // ===========================

            const logChannel =
                interaction.guild.channels.cache.get(
                    LOG_CHANNEL_ID
                );

            if (logChannel) {

                const embed =
                    new EmbedBuilder()

                        .setTitle('🔒 Ticket zamknięty')

                        .addFields({

                            name: '👤 Zamknął',

                            value:
                                `${interaction.user}`

                        })

                        .setTimestamp();

                await logChannel.send({

                    embeds: [embed]

                });

            }

            // ===========================
            // USUNIĘCIE
            // ===========================

            setTimeout(() => {

                channel.delete()
                    .catch(() => {});

            }, 5000);

        }

    }

});

// ===============================
// LOGOWANIE
// ===============================

client.login(TOKEN);