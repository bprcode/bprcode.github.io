function parse () {
    let input = document.querySelector('#input-text')
    let output = document.querySelector('#output-text')

    output.value = input.value
    if (output.value.slice(-1) !== '\n')
        output.value += '\n'

    output.value = output.value.replace(/([^\n]*)\n/g, '"$1",\n')
    output.value = output.value.slice(0,-2)
}

document.addEventListener('DOMContentLoaded', parse)
document.querySelector('#input-text')
    .addEventListener('input', parse)
