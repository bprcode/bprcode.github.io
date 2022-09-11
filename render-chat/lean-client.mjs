import { blue, green, yellow, pink, rnd, dim } from './handy.mjs'
import { WebClient } from './web-chat.mjs'
import { Popup } from './popup.mjs'

// make logging a no-op for deployment:
let log = () => {}
log.queue = () => {}
log.send = () => {}

const socketServer = 'ws://localhost:3303'

const renderChat = Handlebars.compile(
    document.querySelector('#chat-message').innerHTML)

Handlebars.registerHelper('clock', function(options) {
    return new Date(parseInt(options.fn(this))).toLocaleTimeString()
})

const renderUserTooltip = Handlebars.compile(
    document.querySelector('#user-tooltip').innerHTML.trim())

const chatClient = new WebClient({
    outputElement: document.querySelector('.chat-container'),
    inputElement: document.querySelector('#input-text'),
    userListElement: document.querySelector('.user-list'),
    preferredNameElement: document.querySelector('.name-field'),
    templateFunction: renderChat,
    userListTipTemplate: renderUserTooltip,
})

chatClient.addEventListener('connect', () => {
    log('Connected to chat server.', green)
    enableUI()
})
chatClient.addEventListener('disconnect', () => {
    log('Disconnected from chat server.', pink)
    disableUI()
})
chatClient.addEventListener('append', appendEvent => {
    appendEvent.detail.element.addEventListener('mouseenter', enterEvent => {
        let rect = enterEvent.target.getBoundingClientRect()
        tooltip.show()
        tooltip.moveTo(rect.left - tooltip.element.offsetWidth, rect.top)
        tooltip.element.textContent = appendEvent.detail.message._serial
    })

    appendEvent.detail.element.addEventListener('mouseleave', leaveEvent => {
        if (leaveEvent.relatedTarget !== tooltip.element) {
            tooltip.hide()
        }
    })
})
chatClient.addEventListener('userTooltipAction', event => {
    switch (event.detail.selectedAction) {
        case 'Send message':
            chatClient.startDM(event.detail.selectedUser)
        break;
        case 'Block user':
            chatClient.block(event.detail.selectedUser)
        break;
        case 'Unblock user':
            chatClient.unblock(event.detail.selectedUser)
        break;
        default:
            log(event.detail.selectedAction, ': ', event.detail.selectedUser)
    }
})

chatClient.block(JSON.parse(localStorage.getItem('blockList')))

function updateLocalBlockList () {
    localStorage.setItem('blockList',
        JSON.stringify([...chatClient.blockList]))
}

chatClient.addEventListener('block', updateLocalBlockList)
chatClient.addEventListener('unblock', updateLocalBlockList)

chatClient.preferredName = localStorage.getItem('preferredName') || ''
chatClient.connect(socketServer)

let tooltip = new Popup()
tooltip.hide()
tooltip.element.textContent = 'hello!'
tooltip.element.style.width = '30px'
tooltip.element.style.height = '30px'
tooltip.element.style.paddingBottom = '30px'
tooltip.element.style.paddingLeft = '4px'
tooltip.element.style.paddingRight = '40px'
tooltip.element.style.fontSize = '2rem'
tooltip.element.style.zIndex = '99'
tooltip.element.addEventListener('mouseleave', event => {
    tooltip.hide()
})
disableUI()

function disableUI() {
    document.querySelector('.spin-container').classList.remove('hide')
    for (const e of document.querySelectorAll('button')) {
        e.classList.add('deactivated')
        e.setAttribute('disabled', true)
    }
}
    
function enableUI() {
    document.querySelector('.spin-container').classList.add('hide')
    for (const e of document.querySelectorAll('button')) {
        e.classList.remove('deactivated')
        e.removeAttribute('disabled')
    }
}

document.querySelector('#send-chat')
    .addEventListener('click', event => chatClient.readLine())
document.querySelector('#clear-history')
    .addEventListener('click', event => chatClient.clear())
document.querySelector('#test-disconnect')
    .addEventListener('click', event => chatClient.disconnect())

document.querySelector('#input-text')
    .addEventListener('keydown', event => {
    
    if (event.keyCode === 13) {
        document.querySelector('#send-chat').dispatchEvent(new Event('click'))
        document.querySelector('#send-chat').classList.add('flash')
        setTimeout(() => {
            document.querySelector('#send-chat').classList.remove('flash')
        }, 50)
    }
})

document.querySelector('.name-field').addEventListener('focus', function() {
    document.querySelector('.name-field').select()
})

document.querySelector('.name-field').addEventListener('input',
    function nameInput (event) {

    let field = document.querySelector('.name-field')

    field.size = field.value.length || 1

    if (nameInput.timeout)
        clearTimeout(nameInput.timeout)
    // Read the text after it has been updated
    nameInput.timeout = setTimeout(() => {
        let newName = field.value
        if (newName !== chatClient.preferredName) {
            chatClient.preferredName = newName
            localStorage.setItem('preferredName', chatClient.preferredName)
            chatClient.transmit({
                request: 'rename',
                text: chatClient.preferredName
            })

            document.querySelector('#input-text').focus()
        }
    }, 3000)

    if (event.keyCode === 13)
        event.preventDefault()
})
