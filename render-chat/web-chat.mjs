import { Conveyor } from './conveyor.mjs'
import { ResponsiveList } from './responsive-list.mjs'
import { Popup } from './popup.mjs'
import { moo, pink, green, blue, yellow, dim } from './handy.mjs'

// make logging a no-op for deployment:
let log = () => {}
log.queue = () => {}
log.send = () => {}

// WebSocket-based chat client interface.
// Tracks chat client state, sorts messages by timestamp, invokes
// rendering callbacks to display new messages, sends outbound messages.
export class WebClient extends EventTarget {
    socket = null
    messageConveyor = null
    messageList = new ResponsiveList
    userList = []
    tooltip = null

    /**
   * Create a new `WebClient` instance, a user client to a WebSocket-
   * based chat interface. The corresponding server-side component is
   * implemented in chat-channel.cjs in classes ChatChannel and WebSocketRelay.
   * 
   * Emits:
   * 
   * 'append' -- detail: {element, message}
   * The client has created HTMLElement `element` and rendered it with
   * content `message`.
   * 
   * 'remove' -- detail: {element, message}
   * The client is dropping a message from its memory and removing the
   * associated HTMLElement.
   * 
   * 'connect' --
   * The WebSocket has been connected and the client has just transmitted
   * an "identify" notification to the server, which should result in the
   * server allowing this socket to begin listening to chat messages.
   * 
   * 'disconnect' --
   * The WebSocket has been disconnected.
   * 
   * 'error' --
   * The WebSocket has encountered an error.
   * 
   * 'receive' -- detail: {message}
   * The client has just received an incoming message from the server and is
   * about to process it.
   * 
   * 'transmit' -- detail: {message}
   * The client is about to send an outgoing message to the server.
   * 
   * 'block' -- detail: {name} Begin blocking messages from a username.
   * 
   * 'unblock' -- detail: {name} Cease blocking messages from a username.
   * 
   * 'userTooltipAction' -- detail: {selectedAction, selectedUser}
   * A child element of the user list tooltip has been clicked, where
   * textContent was `selectedAction`.
   *
   * @param {String} [options.server] URL of the WebSocket server to join.
   * @param {String} [options.sid] Session ID to use, random UUID by default
   * @param {HTMLElement} [options.outputElement] Element to append to when
   *    displaying new messages.
   * @param {HTMLElement} [options.inputElement] Element from which to read
   *     user input upon calls to readLine().
   * @param {HTMLElement} [options.userListElement] Element to which to write
   *    elements displaying the list of currently connected users.
   * @param {HTMLElement} [options.preferredNameElement] Element from which to
   *    read the user's requested username.
   * @param {String} [options.preferredName] The username the client wishes
   *    to be displayed as, if available.
   * @param {Set} [options.blockList] Set of usernames to block messages from.
   * @param {Function} [options.templateFunction] Function used to render
   *    chat message objects into HTML elements, which are then appended to
   *    the outputElement.
   * @param {Function} [options.userListTipTemplate] Function used to render
   *    the information offered in a tooltip when selecting a user from
   *    the user list.
   * @param {Number} [options.reconnectInterval] Number of seconds to wait
   *    between checks of the connection status. Will then attempt reconnect
   *    if the socket is disconnected.
   * @param {Number} [options.maxMessages] The maximum number of messages to
   *    store in the client message history.
   */
    constructor (options) {
        super()
        options = {
            server: null,
            sid: crypto.randomUUID(),
            inputElement: null,
            outputElement: null,
            userListElement: null,
            preferredNameElement: null,
            preferredName: '',
            blockList: new Set(),
            templateFunction: null,
            userListTipTemplate: null,
            reconnectInterval: 5000,
            maxMessages: 50,
            ...options
        }
        Object.assign(this, options)

        initializeChatConveyor(this)

        this.tooltip = new Popup({ cssClass: 'user-hover-tooltip' })
        this.tooltip.hide()
        this.tooltip.element.textContent = 'test chat tooltip'
        this.tooltip.element.addEventListener('mouseleave', () => {
            this.tooltip.hide()
        })

        // Initialize callbacks for message insertion and deletion.
        let parent = this
        this.messageList.onAdd = function () {
            // In context, 'this' will be the node being added,
            // not this = WebClient as in the rest of the constructor.
            this.message = this.content
            // Use "this" to expose the node being added.
            parent.onRender(this)
            if (this.element) {
                parent.dispatchEvent(new CustomEvent('append', {
                    detail: {   element: this.element,
                                message: this.message }
                }))
            }
        }
        this.messageList.onRemove = function () {
            if (this.element) {
                parent.dispatchEvent(new CustomEvent('remove', {
                    detail: {   element: this.element,
                                message: this.messsage }
                }))
            }
            // Use "this" to expose the node being added.
            parent.onDelete(this)
        }

        // May omit server initialization and connect later.
        if (this.server)
            this.connect(this.server)

        
        setInterval(() => {this.reconnect()}, this.reconnectInterval)
    }

    connect (server) {
        if (this.server !== server) {
            this.clear()
            this.lastSeen = -1
        }
        this.server = server
        this.socket?.close()
        this.socket = new WebSocket(server)
        this.lastSeen ??= -1

        // Handle incoming socket messages
        this.socket.addEventListener('message', event => {
            this.receive(event.data)
        })

        this.socket.addEventListener('open', () => {
            this.transmit({
                request: 'identify',
                sid: this.sid,
                name: this.preferredName
            })
            this.dispatchEvent(new CustomEvent('connect'))
        })
        this.socket.addEventListener('close', () => {
            this.dispatchEvent(new CustomEvent('disconnect'))
        })
        this.socket.addEventListener('error', () => {
            this.dispatchEvent(new CustomEvent('error'))
        })
    }

    reconnect () {
        // If the socket is already functional, do not attempt to reconnect.
        if (this.socket && this.socket.readyState !== WebSocket.CLOSED)
            return
        
        if (this.server)
            this.connect(this.server)
    }

    disconnect () {
        this.socket?.close()
    }

    // Default rendering callback -- may override as appropriate
    // for a particular page.
    onRender (node) {
        if (!this.outputElement) {
            throw new Error(`WebClient: No output element set -- assign `
                            + `HTMLElement to .outputElement or write `
                            + `a different callback to .onRender`)
        }

        let temporary = document.createElement('div')
        if (this.templateFunction) {
            temporary.innerHTML = this.templateFunction(node.message)
        }
        else {
            log('❕ WebClient: Assign a function to .templateFunction', yellow)
            temporary.innerHTML = '<div></div>'
            temporary.firstChild.textContent = node.message.text
        }
        // Store a reference to the rendered DOM nodes
        node.element = temporary.firstChild
        node.content = node.element // just for graph() purposes

        // Now insert the rendered nodes into the DOM:
        // If this message had sibling(s), insert relative to them.
        if (node.previous) {
            node.previous.element.after(node.element)
        }
        else if (node.next) {
            node.next.element.before(node.element)
        }
        else {
            // Otherwise, if there were no siblings, start the chain:
            this.outputElement.append(node.element)
        }

        this.outputElement.lastChild
            ?.scrollIntoView({ behavior: 'smooth' })
    }

    onDelete (node) {
        node.element.remove()
    }

    receive (message) {
        if (typeof message === 'string') {
            try {
            message = JSON.parse(message)
            } catch (err) {
                log.err('Error parsing JSON data: ', err.message)
                return
            }
        }

        this.dispatchEvent(new CustomEvent('receive', { detail: message }))
        this.messageConveyor.process(message)
    }

    transmit (message) {
        if (this.socket === null)
            throw new Error('Unable to transmit message -- no socket set.')

        this.dispatchEvent(new CustomEvent('transmit', { detail: message }))
        this.socket.send(JSON.stringify(message))
    }

    clear () {
        while (this.messageList.head) {
            this.messageList.head.remove()
        }
    }

    block (name) {
        if (name === null)
            return

        if (Array.isArray(name)) {
            for (const n of name) {
                this.block(n)
            }
            return
        }
        
        if ( ! this.blockList.has(name.toLowerCase()) ) {
            this.blockList.add(name.toLowerCase())
            this.dispatchEvent(new CustomEvent('block',
                { detail: name.toLowerCase() }))
            this.buildUserList(this.userList)
        }
    }

    unblock (name) {
        this.blockList.delete(name.toLowerCase())
        this.dispatchEvent(new CustomEvent('unblock',
                { detail: name.toLowerCase() }))
        this.buildUserList(this.userList)
    }

    readLine () {
        if (this.socket.readyState !== WebSocket.OPEN)
            return

        if (!this.inputElement) {
            throw new Error(`WebClient: `
                            +`Assign an HTMLElement to .inputElement`)
        }

        this.parseInput(this.inputElement.value)
        this.inputElement.value = ''
        this.inputElement.focus()
    }

    parseInput (input) {
        input = String(input)
        
        if (input.charAt(0) === '@') {
            // Find matching-ish username
            // Note: this is not optimized at all
            let st = input.slice(1).toLowerCase()
            let candidates = [...this.userList.map(s => s.toLowerCase())]
            let nextCandidates = []
            let idx = 0

            while (candidates.length > 1) {
                for (const c of candidates) {
                    if (c.charAt(idx) === st.charAt(idx)) {
                        nextCandidates.push(c)
                    }
                }

                if (nextCandidates.length === 0) {
                    log('no matches left -- breaking', yellow)
                    input = input.slice(idx + 1)
                    break
                }

                candidates = nextCandidates
                nextCandidates = []
                idx++
                if (idx >= st.length)
                    break

                // Trim the "@user" portion of the message for exact matches
                if (candidates.length === 1) {
                    let s1 = input.slice(1, 1 + candidates[0].length)
                                .toLowerCase()
                    let s2 = candidates[0].toLowerCase()
                    if (s1 === s2)
                        input = input.slice(candidates[0].length + 1)
                }
            }

            // If unable to even guess what the user was going for...
            if (candidates.length === this.userList.length)
                return

            log(candidates.length, 'matches: ', candidates)
            log('outgoing text: ', green, input, ' to ', green, candidates[0])
            this.sendDM(candidates[0], input)
        } else {
            this.transmit({
                text: input
            })
        }
    }

    startDM (recipient) {
        this.inputElement.value = `@${recipient} ` + this.inputElement.value
        this.inputElement.focus()
    }

    sendDM (recipient, text) {
        this.transmit({
            recipient: recipient,
            text: text
        })
    }

    // Insert a message into the chain according to its timestamp
    insertChat (message) {
        // Skip insertion for messages from blocked users,
        // use a regular expression to include direct message formatting.
        if (typeof message.name !== 'undefined'
            && this.blockList.has(
                message.name.match(/[^' →']*/)[0].toLowerCase())) {
            log('Skipping message from blocked user: ' + message.text, pink)
            return
        }

        if (this.messageList.length === 0){
            this.messageList.append(message)
            return
        }

        let time = message._time
        let node = this.messageList.lastWhere(n => n.message._time < time)

        if (node)
            node.append(message)
        else // this will be the oldest message in the chain
            this.messageList.head.prepend(message)
        
        // limit the max number of messages displayed
        while(this.messageList.length > this.maxMessages)
            this.messageList.head.remove()
    }

    buildUserList (newUserList) {
        this.userList = newUserList

        if (this.userListElement) {
            this.userListElement.textContent = ''
            const closeTooltip = (event) => {
                if (event.relatedTarget !==  this.tooltip.element)
                    this.tooltip.hide()
            }

            for (const u of newUserList) {
                let blocked = false
                if (this.blockList.has(u.toLowerCase()))
                    blocked = true

                let div = document.createElement('div')
                if (blocked)
                    div.textContent = '❌ ' + u
                else
                    div.textContent = u

                this.userListElement.append(div)

                // Abbreviate over-long names.
                let abbreviation = u
                while (div.offsetHeight > 32
                        && abbreviation.length > 7) {
                    abbreviation = abbreviation.slice(0,
                                        abbreviation.length - 2)
                    if (blocked)
                        div.textContent = '❌ ' + abbreviation + '...'
                    else
                        div.textContent = abbreviation + '...'
                }
                
                const expandTooltip = (event) => {
                    const pixelOffset = 10
                    let rect = event.target.getBoundingClientRect()

                    if (this.userListTipTemplate) {
                        // Render the tooltip using the template function.
                        this.tooltip.element.innerHTML =
                            this.userListTipTemplate({
                                name: u,
                                blocked: blocked
                            })

                        // Register userTooltipAction events triggered whenever
                        // a child element from the tooltip is clicked.
                        for (const action of this.tooltip.element.children) {
                            action.addEventListener('click', event => {
                                this.dispatchEvent(new CustomEvent(
                                    'userTooltipAction', { detail: {
                                        selectedAction: action.textContent,
                                        selectedUser: u
                                    } }))
                                this.tooltip.hide()
                            })
                        }

                    } else {
                        this.tooltip.element.textContent = '>>'+u
                    }

                    this.tooltip.moveTo(
                        rect.left - this.tooltip.element.offsetWidth
                        + pixelOffset,
                        rect.top + pixelOffset)
                    this.tooltip.show()
                }

                if (u === this.preferredName)
                    continue    // Do not add a tooltip to the user's own entry
                
                div.addEventListener('mouseenter', expandTooltip)
                div.addEventListener('click', expandTooltip)
                div.addEventListener('mouseleave', closeTooltip)
            }
        }
    }
}

/**
 * Initializes a WebClient's Conveyor, establishing routing logic for various
 * types of messages passing to and from the server.
 * @param {WebClient} client Instance of WebClient to initialize
 */
function initializeChatConveyor (client) {
    client.messageConveyor = new Conveyor
    client.messageConveyor
    .use({ _set: '*'}, m => {
        log.queue('Instructed to set: ', blue, m._set, green, ' to: ', blue,
                m.value, green)
    })
    .use({ _set: 'users' }, m => {
        client.buildUserList(m.value)
    })
    .use({ _set: 'name' }, m => {
        client.preferredName = m.value
        if (client.preferredNameElement) {
            client.preferredNameElement.value = m.value
            client.preferredNameElement.size = m.value.length
        }
    })
    .use({ _set: 'rename' }, m => {
        if (client.blockList.has(m.value[0].toLowerCase())) {
            client.unblock(m.value[0])
            client.block(m.value[1])
        }
    })
    .use({ _set: 'lastSeen'}, m => {
        // n.b. this is slightly different than noticing a message gap
        // message gap requests skip the current serial, since it would
        // be covered by the message itself.
        if (m.value > client.lastSeen) {
            log.queue(' ...Need on-connect history. Requesting ', pink,
                client.lastSeen +1, ' to ', m.value)
            
            client.transmit({
                request: 'history',
                first: client.lastSeen +1,
                last: m.value
            })

            // Assume the requested history will be seen, eventually:
            client.lastSeen = m.value
        }

        // Request history which was likely missed during a server restart.
        if (m.value < client.lastSeen) {
            log.queue(' ...On-connect history missing. Requesting ', green,
                0, ' to ', m.value)

            client.transmit({
                request: 'history',
                first: 0,
                last: m.value
            })
            client.lastSeen = m.value
        }
        // It is entirely possible that the server could have restarted
        // more than once since the last message was seen, but the
        // previous chat history would then be lost anyway.
    })
    .use({ _set: '*'}, (m, end) => {
        log.send()
        end()
    })
    .use({ _serial: undefined }, m => {
        log.queue(`[x] `, dim)
    })
    .use({ _serial: '*'}, m => {
        log.queue(`[${m._serial}] `, blue)
    })
    .use({ _serial: undefined, history: undefined}, m => {
        log.queue(m.text, yellow)
    })
    .use({ _serial: undefined, history: '*'}, m => {
        log.queue(m.history, `(${m.history.length} history messages)`, dim)
    })
    .use({ _serial: '*' }, function logSerialValues (m) {
        log.queue('...last seen: ', yellow, client.lastSeen, blue,
                    ' then got ', yellow, `${m.text}`)
    })
    // On unexpectedly low serial numbers,
    // request missing history.
    .use(function checkForServerRestart (m) {
        if (m._serial <= client.lastSeen) {
            log.queue('\nDetected possible server restart. Requesting ', green,
                0, ' to ', m._serial -1)
        
            client.transmit({
                request: 'history',
                first: 0,
                last: m._serial -1
            })
        }
    })
    // If there is a gap in the serial numbers,
    // request the missing history.
    .use(function checkForMissingHistory (m) {
        if (m._serial > client.lastSeen +1) {
            log.queue(' ...Missing history. Requesting ', pink,
                client.lastSeen +1, ' to ', m._serial -1)
            
            client.transmit({
                request: 'history',
                first: client.lastSeen +1,
                last: m._serial -1
            })

            // Assume the requested history will be seen, eventually:
            client.lastSeen = m._serial - 1
        }
    })
    // Insert the messages, according to whether they arrived as an array.
    .use(function insertNewMessages (m) {
        if (Array.isArray(m.history)) {
            for (const t of m.history) {
                t.historical = true
                client.insertChat(t)
        
                if (t._serial > client.lastSeen)
                    client.lastSeen = t._serial
            }
        } else {
            client.insertChat(m)
            if (m._serial)
                client.lastSeen = m._serial
        }
    })
    .use({ _serial: '*' }, function logSeenChange (m) {
        log.queue('... after, last seen: ', yellow,
                    client.lastSeen, green)
    })
    .use(() => {
        log.send()
    })
}
