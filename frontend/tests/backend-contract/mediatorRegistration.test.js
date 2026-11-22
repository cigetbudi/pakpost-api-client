import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = relative => readFileSync(join(root, relative), 'utf8')

function findCs(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = join(dir, entry.name)
    if (entry.isDirectory()) return findCs(file)
    return entry.name.endsWith('.cs') ? [file] : []
  })
}

test('Mediator source generator is registered only in executable and uses scoped lifetime', () => {
  const api = read('backend/src/Pakpost.Api/Pakpost.Api.csproj')
  const app = read('backend/src/Pakpost.Application/Pakpost.Application.csproj')
  const program = read('backend/src/Pakpost.Api/Program.cs')
  assert.match(api, /Mediator\.SourceGenerator" Version="3\.0\.2"/)
  assert.match(app, /Mediator\.Abstractions" Version="3\.0\.2"/)
  assert.doesNotMatch(app, /MediatR/)
  assert.doesNotMatch(app, /Mediator\.SourceGenerator/)
  const mediatorRegistration = read('backend/src/Pakpost.Api/Extensions/MediatorServiceExtensions.cs')
  assert.match(program, /builder\.Services\.AddMediatorServices\(\)/)
  assert.match(mediatorRegistration, /ServiceLifetime\.Scoped/)
  assert.match(mediatorRegistration, /options\.PipelineBehaviors = \[typeof\(ValidationBehavior<,>\)\]/)
  assert.match(mediatorRegistration, /options\.Assemblies = \[typeof\(RegisterCommand\)\]/)
})

test('all CQRS handlers use ValueTask without MediatR references', () => {
  const internal = join(root, 'backend/src/Pakpost.Application/Internal')
  const sources = findCs(internal).map(f => readFileSync(f, 'utf8'))
  const joined = sources.join('\n')
  const handlerCount = (joined.match(/IRequestHandler</g) || []).length
  assert.ok(handlerCount >= 37) // V8.5 adds three history/restore handlers
  assert.equal((joined.match(/ValueTask(?:<[^\n]+>)? Handle\(/g) || []).length, handlerCount)
  assert.doesNotMatch(joined, /using MediatR;|public (?:async )?Task(?:<[^\n]+>)? Handle\(/)
  assert.ok((joined.match(/return Unit\.Value;/g) || []).length >= 4)
})

test('Bun migration keeps React, Vite, QuickJS and existing dev/build scripts', () => {
  const pkg = JSON.parse(read('frontend/package.json'))
  assert.equal(pkg.packageManager, 'bun@1.4.4')
  assert.equal(pkg.scripts.dev, 'vite --host 127.0.0.1')
  assert.equal(pkg.scripts.build, 'vite build')
  assert.match(pkg.scripts.test, /^bun test(?:\s|$)/)
  assert.equal(pkg.dependencies['quickjs-emscripten-core'], '0.32.0')
  assert.equal(pkg.dependencies['@jitl/quickjs-singlefile-browser-release-sync'], '0.32.0')
  assert.equal(pkg.dependencies['crypto-js'], '4.2.0')
})

test('Bun conversion preserves npm lockfile until validation succeeds', () => {
  const script = read('frontend/scripts/activate-bun.sh')
  assert.match(script, /bun pm migrate/)
  assert.match(script, /bun install --frozen-lockfile/)
  assert.match(script, /bun run test/)
  assert.match(script, /bun run build/)
  assert.doesNotMatch(script, /rm\s+(?:-f\s+)?package-lock\.json/)
})
