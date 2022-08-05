for (const ta of document.querySelectorAll('textarea')) {
    ta.addEventListener('scroll', event => {
        let y = ta.scrollTop - 4
        y *= -1
        ta.style['background-position-y'] = `${y}px`
    })
}