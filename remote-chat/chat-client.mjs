import { log, moo, blue, pink, green, yellow, dim, rnd } from './handy.mjs'

let chatServer = null
const renderChat = Handlebars.compile(
    document.querySelector('#chat-message').innerHTML)

const animals = [
    'Aardvark',
    'Anteater',
    'Armadillo',
    'Badger',
    'Coatimundi',
    'Cormorant',
    'Octopus',
    'Crocodile',
    'Gecko',
    'Parakeet',
    'Shark',
    'Stork',
    'Toucan',
    'Ostrich',
    'Ocelot',
    'Pangolin',
    'Quokka',
]

// Initialize page and connection
let lastSeen = 0
let es = null
let nomDePlume = animals[rnd(0, animals.length - 1)]

document.querySelector('.name-field').textContent = nomDePlume

// --
;(async function entryPoint() {
try {
    let reply = await fetch('serverLocation.json')
    let info = await reply.json()
    log('Using remote chat server: ', blue, info.url)
    chatServer = info.url
    pokeServer()
} catch (er) {
    log.err('Static server initialization file missing. Cannot start client.')
}
})()

async function pokeServer () {
try {
    let u = new URL('/poke', chatServer)
    let reply = await fetch(u)
    log('Server active.', green)
    document.querySelector('.spin-container').classList.add('hide')
    initiateConnection()
} catch (er) {
    document.querySelector('.spin-container').classList.remove('hide')
    log.err('Server unavailable: ', er.message, '\nAttempting reconnect...')
    setTimeout(pokeServer, 5000)
}}

async function initiateConnection () {
    let listenUrl = new URL('/chat', chatServer)
    listenUrl.searchParams.append('user', nomDePlume)
    es = new EventSource(listenUrl)
    bindChatListeners(es)
}

setInterval(() => {
    if (es?.readyState === es.CLOSED) {
        log('Connection lost. Attempting restart.', yellow)
        initiateConnection()
    }
}, 10000)

function writeChat (message) {
    const messageLimit = 100

    if (typeof message !== 'object') {
        message = {notification: String(message)}
    }
    writeChat.container ??= document.querySelector('.chat-container')
    writeChat.container.insertAdjacentHTML('beforeend', renderChat(message))
    let messages = document.querySelectorAll('.message-content')

    // Trim excess messages
    if(writeChat.container.childElementCount > messageLimit) {
        for (const m of messages) {
            if(writeChat.container.childElementCount <= messageLimit)
                break
            
            m.remove()
        }
    }
    // Show latest message
    messages[messages.length-1].scrollIntoView({behavior:'smooth'})
}

async function reconcileHistory (newest) {
    let records = await fetchHistory(lastSeen, newest)
    let latest = lastSeen

    for (const r of records) {
        if (typeof r.id !== 'undefined' && r.id > lastSeen) {
            writeChat(r)
            // Just in case the records are out of order...
            if (r.id > latest)
                latest = r.id
        }
    }

    lastSeen = latest
}

async function fetchHistory (start, end) {
try {
    let u = new URL('history', chatServer)
    u.searchParams.append('start', start)
    u.searchParams.append('end', end)

    let reply = await fetch(u)
    return await reply.json()
} catch (er) {
    log.err('Unable to transmit history request -- ', er.message, dim)
}}

// Attach event listeners to an EventSource
function bindChatListeners (es) {

    // Handle incoming chat
    es.addEventListener('receive-chat', async event => {
        let message = JSON.parse(event.data)
        // Check for missed messages
        if (typeof message.id !== 'undefined'
                && message.id > lastSeen + 1) {
                log('Reconciling ', yellow, lastSeen, ' to ', yellow, message.id)
                await reconcileHistory(message.id)
        }
        // Check for server restart
        if (typeof message.id !== 'undefined'
                && message.id < lastSeen) {
            log('Server restarted -- retrieving history', pink)
            lastSeen = -1
            await reconcileHistory(message.id)
        }

        lastSeen = message.id ?? lastSeen
        writeChat(message)
    })

    // Handle non-chat messages
    es.addEventListener('message', async event => {
        writeChat(event.data)
        log('Got plain message', dim)
    })
    es.addEventListener('open', event => {
        writeChat('Connection established.')
        document.querySelector('.spin-container').classList.add('hide')
    })

    es.addEventListener('error', event => {
        if (es.readyState === es.CONNECTING) {
            writeChat('Reconnecting...')
            document.querySelector('.spin-container').classList.remove('hide')
        } else {
            writeChat(`Connection terminated. (${es.readyState})`)
        }
    })
}

document.querySelector('#send-chat')
    .addEventListener('click', async event => {
try{
    let text = document.querySelector('.interface input[type="text"]').value
    let data = {
        user: nomDePlume,
        text
    }

    let reply = await fetch(new URL('/send', chatServer), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })

    if (await reply.text() == 'ok') {
        document.querySelector('.clickables input[type="text"]').value = ''
        document.querySelector('.clickables input[type="text"]').focus()
    }
} catch (er) {
    log.err('Error transmitting message.')
}
})

document.querySelector('.clickables input[type="text"]')
    .addEventListener('keydown', event => {
    
    if (event.keyCode === 13)
        document.querySelector('#send-chat').dispatchEvent(new Event('click'))
})

document.querySelector('.name-field').addEventListener('keydown', event => {
    // Read the text after it has been updated
    setTimeout(() => {
    nomDePlume = document.querySelector('.name-field').textContent
    }, 10)

    if (event.keyCode === 13)
        event.preventDefault()
})
