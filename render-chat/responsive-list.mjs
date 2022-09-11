import { log } from './handy.mjs'

export class ResponsiveList {
    head = null
    onAdd = function() {}

    constructor () {
        let originList = this

        this.onAdd = function () {
            // example:
            //console.log(originList.listName, ' callback invoked upon ', this)
        }

        this.onRemove = function () {
            // Callback upon removal of a node
        }

        this.Node = class {
            static parentList = originList
            next = null
            previous = null
            content

            constructor (v = null) {
                this.content = v
            }

            #nodify (x) {
                if (x instanceof this.constructor)
                    return x

                return new this.constructor(x)
            }

            respond () {
                this.constructor.parentList.onAdd.apply(this)
            }

            destruct () {
                this.constructor.parentList.onRemove.apply(this)
            }

            append (x) {
                // Ensure the new sibling is of this type
                let n = this.#nodify(x)

                // handle insertions
                if (this.next) {
                    this.next.previous = n
                    n.next = this.next
                }
                // attach to this node
                this.next = n
                n.previous = this

                // Finally, invoke callback.
                n.respond()
            }

            prepend (x) {
                let n = this.#nodify(x)

                // handle insertions
                if (this.previous) {
                    this.previous.next = n
                    n.previous = this.previous
                }
                // attach to this node
                this.previous = n
                n.next = this

                // potentially update the parent head pointer
                if (this.constructor.parentList.head === this) {
                    this.constructor.parentList.head = n
                }
                // Finally, invoke callback.
                n.respond()
            }

            remove () {
                // invoke destruct before nulling out the pointers
                this.destruct()
                
                // handle case where this is the head node
                if (this.constructor.parentList.head === this) {
                    this.constructor.parentList.head = this.next
                }

                // snip out node
                if (this.next)
                    this.next.previous = this.previous
                if(this.previous)
                    this.previous.next = this.next

                // break references
                this.next = null
                this.previous = null

                // content and other properties are left in case
                // someone wants to relocate this node.
            }
        }
    }

    // ResponsiveList methods
    graph () {
        if ( ! this.head ) {
            log('Empty list.')
            return
        }

        let p = this.head
        while (p) {
            log.queue(p.content)

            if(p.next)
                log.queue(' 🡒 ')

            p = p.next
        }
        log.send()
    }

    append (x) {
        let p = this.tail
        if (p) {
            p.append(x)
        } else {
            this.head = new this.Node(x)
            this.head.respond()
        }
    }

    prepend (x) {
        this.head.prepend(x)
    }

    * [Symbol.iterator] () {
        let p = this.head
        while (p) {
            yield p
            p = p.next
        }
    }

    firstWhere(test) {
        for (const n of this)
            if (test(n))
                return n
        return null
    }

    lastWhere(test) {
        let p = null
        for (const n of this)
            if (test(n))
             p = n
        return p
    }

    get length () {
        let count = 0
        for(const n of this)
            count++

        return count
    }

    get tail () {
        let p = null
        for(const n of this)
            p = n

        return p
    }
}
