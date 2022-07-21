{ // Beginning of block scope for script
const templateSource = document.querySelector('#template-source')
const jsonSource = document.querySelector('#json-source')
const renderedOutput = document.querySelector('#rendered-output')
const jsonLabel = document.querySelector('#json-label')
const templateLabel = document.querySelector('#template-label')
const addButton = document.querySelector('#add-partial')
const partialKeys = []

let textAreas = [templateSource, jsonSource]

for (const d of textAreas) {
    d.addEventListener('input', updateRender)
    d.addEventListener('scroll', () => {scrollBackground(d)})
}

// Working around background-attachment: local failure bug in Firefox
function scrollBackground (element) {
    let y = element.scrollTop - 4
    y *= -1
    element.style['background-position-y'] =
        `${y}px`
}

function updateRender () {
    jsonSource.style['box-shadow'] = ''
    templateSource.style['box-shadow'] = ''

    const errorStyle = 'inset 0px 0px 16px #f00a'
    let parsed

    try {
        parsed = JSON.parse(jsonSource.value)
    } catch (err) {
        jsonSource.style['box-shadow'] = errorStyle
        jsonLabel.textContent = 'Object (invalid JSON)'
        renderedOutput.value = err.message.split('JSON.parse: ')[1]
        return
    }

    // If the JSON is valid...
    jsonLabel.textContent = 'Object'

    // build up the list of partial templates, if any...
    let partials = {}
    for (const key of partialKeys) {
        partials[key] = document.querySelector(`#${key}`).value
    }

    try {
        renderedOutput.value =
            mustache.render(templateSource.value, parsed, partials)
    } catch (err) {
        templateSource.style['box-shadow'] = errorStyle
        templateLabel.textContent = 'Template (invalid format)'
        renderedOutput.value = `Template error: ${err.message}`
        return
    }

    templateLabel.textContent = 'Template'
}

function addAnotherPartial () {
    
    let newSpan = document.createElement('span')
    let newLabel = document.createElement('label')
    let newTextArea = document.createElement('textarea')
    let key = `partial${partialKeys.length + 1}`
    partialKeys.push(key)
    
    console.log(`Creating ${key}...`)
    newLabel.textContent = key
    newTextArea.value = `${key} template`
    newTextArea.rows = 8
    newTextArea.cols = 30
    newTextArea.classList.add('partial')
    newTextArea.id = key
    newTextArea.addEventListener('input', updateRender)
    newTextArea.addEventListener('scroll', () =>
        {scrollBackground(newTextArea)})

    newSpan.appendChild(newLabel)
    newSpan.appendChild(newTextArea)

    
    document.querySelector('.triptych').appendChild(newSpan)
}

addButton.addEventListener('click', addAnotherPartial)

document.addEventListener('DOMContentLoaded', () => {
    updateRender()
})


} // End of block scope for script
