const { Telegraf } = require('telegraf');
require('dotenv').config();
const bot = new Telegraf(process.env.BOT_TOKEN);

const axios = require('axios');
axios.defaults.headers.common['X-XSRF-TOKEN'] = process.env.AXIOS_TOKEN;
axios.defaults.headers.common['Cookie'] = process.env.COOKIE;

const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('Bot is working now !!')
});

app.listen(process.env.PORT || 5000);

bot.catch((err, ctx) => {
    console.log('ctx--catch==========>', err)
    let mainError;
    if (err.description) mainError = err.description.split(': ')[1];
    else if (typeof (err) == 'string') {
        mainError = err.split(': ')[1];
    }
    if (!mainError) return;
    ctx.reply(mainError);
});

/*
Variables...
*/

var current_account = 'online_contents';
var searchCmdCounter = 0;
var searchCmdQuery = '';
/*
Functions
*/

function getFromId(ctx) {
    if (ctx.message) {
        return ctx.message.from.id
    } else if (ctx.callbackQuery) {
        return ctx.callbackQuery.from.id
    } else {
        return null
    }
};

function isAdmin (ctx) {
    const fromId = getFromId(ctx)
    if (!fromId || process.env.SUDO_USERS != fromId) return { success: false , error: '🚫️ This command is admin only !!!'}
    else return { success: true }
};

function secondsToHms(d) {
    d = Number(d);
    const h = Math.floor(d / 3600);
    const m = Math.floor(d % 3600 / 60);
    const s = Math.floor(d % 3600 % 60);

    return `${h}:${m}:${s}`;
};

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

async function searchMyVideos (itemId = '', title = '') {
    let url = process.env.searchMyVideosAPI;
    url = url.replace('${itemId}', itemId);
    url = url.replace('${title}', title);
    
    const res = await axios.get(url);

    if (!res.data.isSuccess) {
        return { error: res.data.msg };
    } else if (res.data.data.total > 0) {
        return { data: res.data.data.list, total: res.data.data.total }
    } else return { error: 'No results found' };
};


async function searchAllVideos (query, counter) {
    let url = process.env.searchAllVideosAPI;
    url = url.replace('${query}', query);
    url = url.replace('${counter}', counter);
    
    const res = await axios.get(url);

    if (!res.data.isSuccess) {
        return { error: res.data.msg };
    } else if (res.data.data.total > 0) {
        return { data: res.data.data.list, total: res.data.data.total }
    } else return { error: 'No Results Found' }
};

async function saveVideo (link, title, description) {
    const params = {
        content_src: link,
        description: description || "Uploaded By @my_channels_list_official",
        dir_id: "0",
        link_type: "link",
        source: 2000,
        title: title || "Telegram : @my_channels_list_official",
        uid: current_account === 'online_contents' ? "79542932" : "42211234"
    };
    
    const url = process.env.saveVideoAPI;

    const response = await axios.post(url, params);
    console.log('save_video_response', response.data)
    if (!response.data.isSuccess) {
        return { error: response.data.msg };
    };

    const newlink = await axios.post(`https://www.pdisk.net/api/ndisk-api/content/gen_link?itemId=${response.data.data.item_id}`);
    console.log('newlink-data', newlink.data)
    if (!newlink.data.isSuccess) {
        return { error: newlink.data.msg };
    };
    return { newURL: newlink.data.data.url, item_id: String(response.data.data.item_id) };
};

async function getDetails (itemId) {
    let url = process.env.getDetailsAPI;
    url = url.replace('${itemId}', itemId);
    
    const res = await axios.get(url);

    if (!res.data.isSuccess) {
        return { error: res.data.msg };
    } else if (res.data.data.attachments.length > 0) {
        return res.data.data;
    } else return { error: 'No Results Found' }
}

async function deleteVideo (itemId) {
    const params = {
        _isEncode: "N",
        itemIds: itemId
    };
    
    const url = process.env.deleteVideoAPI;

    const response = await axios.post(url, params);

    if (!response.data.isSuccess) {
        return { error: response.data.msg };
    };

    return response.data.msg;
};

function get_cookies () {
    return axios.defaults.headers.common['Cookie'] || 'Not Found !!';
};

function get_xsrf () {
    return axios.defaults.headers.common['X-XSRF-TOKEN'] || 'Not Found !!';
};

async function set_cookie (ID) {
    const params = { "userName": process.env[`${ID}_USERNAME`], "password": process.env[`${ID}_PASSWORD`] };
    const url = process.env.loginAPIAPI;
    try {
        const res = await axios.post(url, params);
        const cookies = res.headers['set-cookie'];
        const arrayOfCookies = cookies.map(cookie => cookie.split(';')[0]);
        
        const xsrf_token = arrayOfCookies.filter(cookie => cookie.includes('csrfToken='));
        axios.defaults.headers.common['X-XSRF-TOKEN'] = xsrf_token[0].split('csrfToken=')[1];
        
        var set_cookies = arrayOfCookies.join('; ');
        axios.defaults.headers.common['Cookie'] = set_cookies;
        return `_Suceess_ !!!\n\n*Cookie:*\n\n\`${get_cookies()}\`\n\n*XSRF:*\n\n\`${get_xsrf()}\``;
    } catch (error) {
        return error;
    };
};

async function searchResultReply (ctx, response, query, counter) {
    const message_id = ctx.callbackQuery ? ctx.callbackQuery.message.message_id : ctx.message.message_id;
    if (ctx.message) ctx.telegram.deleteMessage(ctx.chat.id, message_id + 1);

    let message_type = ctx.message ? 'reply' : 'editMessageText';

    let inline_keyboard = response.data.map((res) => {
        const title = (res.title).replace(/<\/?[^>]+(>|$)/g, "");
        return [{ text: `[${res.file_size || 'Unknown Size'}] ${title}` || '', callback_data: `id--${res.item_id}--${title}` }];
    });

    let moveButtons = [ { text: 'Next ▶️', callback_data: `next` } ];
    if (counter > 1) moveButtons = [ { text: '◀️ Previous', callback_data: `prev` }, { text: 'Next ▶️', callback_data: `next` } ];
    
    inline_keyboard = response.data.length > 10 ? [...inline_keyboard, moveButtons] : [...inline_keyboard];

    ctx[message_type](`Showing results for *${query}*\nCurrent Page: *${counter}*\n\nTotal results found: *${response.data.length}*`, {
        parse_mode: 'markdown',
        reply_markup: {
            inline_keyboard: inline_keyboard
        }
    });
    
    if (ctx.callbackQuery) ctx.answerCbQuery();
};

/*
Bot
*/

bot.start((ctx) => {
    ctx.reply(`Hi *${ctx.from.first_name}*!!\n\nWelcome To *Pdisk Search Videos Bot* ⚡️\n\n🤖️ I\'m not a simple bot at all.\n🔍️I can search anything from pdisk.\n\nOfficial bot of @temp\\_demo`, {
        parse_mode: 'markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "📂 Join Our Main Channel", url: 'https://t.me/my_channels_list_official' }
                ],
                [
                    { text: "Help 💡️", callback_data: 'help' }
                ]
            ]
        }
    });
});

bot.on('callback_query', async (ctx) => {
    if (ctx.callbackQuery.data === 'help') {
        ctx.editMessageText(`You can search files by :\n\n• Send any *Movies, Web-Series, Serials* _(Anything do you want)_ name to bot this way (/search {movie\\_name}) and see the magic 🃏️.`, {
            parse_mode: 'markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "📂 Join Our Main Channel", url: 'https://t.me/my_channels_list_official' }
                    ],
                    [
                        { text: "Home 🏠️", callback_data: 'menu' }
                    ]
                ]
            }
        })
    }
    if (ctx.callbackQuery.data === 'menu') {
        ctx.editMessageText(`Hi *${ctx.from.first_name}*!!\n\nWelcome To *Pdisk Search Videos Bot* ⚡️\n\n🤖️ I\'m not a simple bot at all.\n🔍️I can search anything from pdisk.\n\nOfficial bot of @temp\\_demo`, {
            parse_mode: 'markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "📂 Join Our Main Channel", url: 'https://t.me/my_channels_list_official' }
                    ],
                    [
                        { text: "Help 💡️", callback_data: 'help' }
                    ]
                ]
            }
        });
    }
    if (ctx.callbackQuery.data.match(/id(.*)/)) {
        await ctx.telegram.sendAnimation(ctx.chat.id, 'CAACAgQAAxkBAAOxYYzVUAkggisT-v8rehV_dQaYQrEAArIKAAInyWBQG81d8MwiX-EiBA');
        console.log('ctx======', ctx.callbackQuery);
        const itemID = ctx.callbackQuery.data.split('--')[1];
        const title = ctx.callbackQuery.data.split('--')[2];
        const pdiskLink = `https://pdisks.com/share-video?videoid=${itemID}`;
        
        let isExists = true;

        const isExistsData = await searchMyVideos('', title);

        if (isExistsData.error && isExistsData.error != 'No Results Found') {
            return ctx.reply(isExistsData.error);
        } else isExists = false;


        if (!isExists) {
            let new_url = await saveVideo(pdiskLink, title, 'Telegram : @my_channels_list_official');
            if (new_url.error) return ctx.reply(new_url.error);
        }

        const res = await getDetails(isExists ? isExistsData[0].item_id : new_url.item_id);
        if (res.error) return ctx.reply(res.error);

        console.log('ander-res==>', res);

        const duration = secondsToHms(res.logData.duration);
        let size = [];
        const cover_url = res.attachments[0].cover;

        if (res.attachments[0].videos.length > 0) {
            res.attachments[0].videos.forEach (ele => {
                size.push(ele.file_size);
            })
        }

        console.log('title', title)
        console.log('duration', duration)        
        console.log('size', size)

        let caption = `[${title}](${pdiskLink||new_url.newURL})\n\n*┏━━━━━━━━━━━━━━━━┓*\n\n    *File Size :* ${formatBytes(size[0])}\n    *Duration :* ${duration}\n\n┗━━━━━━━━━━━━━━━━┛`;

        if (size.length === 2) {
            let lowQTSize = size[0];
            let highQTSize = size[1];

            if (Number(size[0]) > Number(size[1])) {
                lowQTSize = size[1];
                highQTSize = size[0];
            }

            lowQTSize = formatBytes(lowQTSize);
            highQTSize = formatBytes(highQTSize);

            caption = `[${title}](${new_url.newURL})\n\n*┏━━━━━━━━━━━━━━━━━━━━━━━┓*\n\n     *360P     *  -  *File Size :* ${lowQTSize}\n\n     *Original*  -  *File Size :* ${highQTSize}\n\n     *Duration :* ${duration}\n\n*┗━━━━━━━━━━━━━━━━━━━━━━━┛*`;
        }
        
        ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id + 1);
        
        ctx.telegram.sendPhoto(ctx.chat.id, cover_url, { 
            caption: caption,       
            parse_mode: 'markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "🎬 Click Here For Pdisk Link", url: `${new_url.newURL}` }
                    ],
                    [
                        { text: "📂 Join Our Main Channel", url: 'https://t.me/my_channels_list_official' }
                    ]
                ]
            }    
        })
    }
    if (ctx.callbackQuery.data.match(/next(.*)/)) {
        let getQuery = ctx.callbackQuery.message.text.split('Showing results for ')[1];
        getQuery = getQuery.substr(0, getQuery.indexOf("\n"));
        
        let getPageCounter = ctx.callbackQuery.message.text.split('Current Page: ')[1];
        getPageCounter = getPageCounter.substr(0, getPageCounter.indexOf("\n"));
        
        getPageCounter = Number(getPageCounter);
        getPageCounter += 1;
        
        const response = await searchAllVideos(getQuery, getPageCounter);
        if (response.error) return ctx.reply(response.error);

        return searchResultReply(ctx, response , getQuery, getPageCounter);
    }
    if (ctx.callbackQuery.data.match(/prev(.*)/)) {
        let getQuery = ctx.callbackQuery.message.text.split('Showing results for ')[1];
        getQuery = getQuery.substr(0, getQuery.indexOf("\n"));

        let getPageCounter = ctx.callbackQuery.message.text.split('Current Page: ')[1];
        getPageCounter = getPageCounter.substr(0, getPageCounter.indexOf("\n"));
        
        getPageCounter = Number(getPageCounter);
        if (getPageCounter != 1) {
            getPageCounter -= 1;
        }

        const response = await searchAllVideos(getQuery, getPageCounter);
        if (response.error) return ctx.reply(response.error);

        return searchResultReply(ctx, response , getQuery, getPageCounter);
    }
    ctx.answerCbQuery();
});

bot.command('switch_account', (ctx) => {
    const isAllowed = isAdmin(ctx);
    if (!isAllowed.success) return ctx.reply(isAllowed.error);
    
    if (current_account === 'online_contents') current_account = 'online_content';
    else current_account = 'online_contents';
});

bot.command('current_account', (ctx) => {
    const isAllowed = isAdmin(ctx);
    if (!isAllowed.success) return ctx.reply(isAllowed.error);
    
    const id = current_account === 'online_contents' ? "79542932" : "42211234"
    ctx.reply(`You are currently using this pdisk account \n\n➥ user-name: ${current_account}\n➥ user-id: ${id}`);
});

bot.command('search', async (ctx) => {
    await ctx.telegram.sendAnimation(ctx.chat.id, 'CAACAgQAAxkBAAPhYYzeh51we7390tj603tUDDLFIGAAAuwJAAInyWhQvClj_JZUKPkiBA');
    
    const query = ctx.message.text.split('/search ')[1];
    
    if (query) {
        if (searchCmdQuery == query) {
            searchCmdCounter += 1;
        } else {
            searchCmdCounter = 1;
            searchCmdQuery = query;
        }
    }

    if (!searchCmdQuery) return ctx.reply('Please send anything valid to search.');
    
    const response = await searchAllVideos(searchCmdQuery, searchCmdCounter);
    if (response.error) {
        await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id + 1);
        return ctx.reply(response.error);
    }

    searchResultReply(ctx, response , searchCmdQuery, searchCmdCounter);
});

bot.command('account_details', (ctx) => {
    const isAllowed = isAdmin(ctx);;
    if (!isAllowed.success) return ctx.reply(isAllowed.error);
    
    ctx.reply(`*Cookie:*\n\n\`${get_cookies()}\`\n\n*XSRF:*\n\n\`${get_xsrf()}\``, {
        parse_mode: 'markdown',
    });
});

bot.command('set_account_1', async (ctx) => {
    const isAllowed = isAdmin(ctx);
    if (!isAllowed.success) return ctx.reply(isAllowed.error);
    
    const response = await set_cookie('online_content'.toUpperCase());
    ctx.reply(response, {
        parse_mode: 'markdown',
    });
});

bot.command('set_account', async (ctx) => {
    const isAllowed = isAdmin(ctx);
    if (!isAllowed.success) return ctx.reply(isAllowed.error);
    
    const response = await set_cookie('online_contents'.toUpperCase());
    ctx.reply(response, {
        parse_mode: 'markdown',
    });
});

bot.launch();
