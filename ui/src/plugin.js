import { getQuickJS } from 'quickjs-emscripten'
import { Arena } from 'quickjs-emscripten-sync'

export function createRequestContextForPlugin(request, environment) {
    let state = JSON.parse(JSON.stringify(request))

    return {
        request: {
            getBody() {
                return state.body
            },
            getEnvironmentVariable(variable) {
                if(variable in environment) {
                    return JSON.parse(JSON.stringify(environment[variable]))
                }

                return undefined
            },
            setBody(requestBody) {
                state.body = requestBody
            }
        }
    }
}

export function createResponseContextForPlugin(response, environment) {
    let bufferCopy = response.buffer.slice(0)

    return {
        response: {
            getBody() {
                return bufferCopy
            },
            getBodyText() {
                return (new TextDecoder('utf-8')).decode(bufferCopy)
            },
            getEnvironmentVariable(variable) {
                return JSON.parse(JSON.stringify(environment[variable]))
            },
            setBody(buffer) {
                bufferCopy = buffer
            },
            setBodyText(bodyText) {
                bufferCopy = (new TextEncoder('utf-8')).encode(bodyText)
            }
        }
    }
}

export async function usePlugin(context, plugin) {
    const vm = (await getQuickJS()).createVm()
    const arena = new Arena(vm, { isMarshalable: true })

    arena.expose({
        console: {
            log: console.log
        },
        context
    })

    try {
        arena.evalCode(plugin.code)
    } catch(e) {
        console.log(e)
        // console.log(plugin.code.split('\n').slice(e.lineNumber - 3, e.lineNumber + 3).join('\n'))
        throw new Error('Unable to parse plugin')
    }

    arena.dispose()
    vm.dispose()
}