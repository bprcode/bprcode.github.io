import { log } from './handy.mjs'

// An OpenList is a linked list where
// the contents may be externally modified at any time.
export class OpenList {
    crown = Object.create(null) // Sits on top of the head

    static insertAfter (node, insertion) {
        if (typeof insertion !== 'object')
            insertion = { value: insertion }
        insertion.next = node.next
        node.next = insertion
    }

    get length () {
        let count = 0
        let p = this.crown.next
        while (p) {
            p = p.next
            count++
        }

        return count
    }

    get tail () {
        let p = this.crown

        while (p.next)
            p = p.next

        return p
    }

    * [Symbol.iterator] () {
        let p = this.crown.next
        while (p) {
            yield p
            p = p.next
        }
    }

    append (n) {
        if (typeof n !== 'object')
            n = { value: n }
        this.tail.next = n
        n.next ??= null
    }

    firstWhere (test) {
        let p = this.crown.next
        while (p) {
            if (test(p)) {
                return p
            }
            p = p.next
        }
        return p
    }

    lastWhere (test) {
        let p = this.crown.next
        let match = null
        while (p) {
            if (test(p)) {
                match = p
            }
            p = p.next
        }

        return match
    }

    insertWhere (test, n) {
        if (typeof n !== 'object')
            n = { value: n }
        let p = this.crown.next
        while (p) {
            if (test(p)) {
                n.next = p.next
                p.next = n
                return true
            }
            p = p.next
        }
        return false
    }

    reverse () {
        let prev = null
        let back = null
        let p = this.crown.next

        do {
            back = p.next
            p.next = prev
            prev = p
            p = back
        } while (p)

        this.crown.next = prev
    }

    graph () {
        let p = this.crown.next
        log.queue('head:')
        while (p) {
            log.queue(p)
            if (p.next)
                log.queue('->')
            
            p = p.next
        }
        log.send()
    }
}
