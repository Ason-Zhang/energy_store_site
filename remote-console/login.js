const $ = (id) => {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Missing element: ${id}`)
  return el
}

const form = $('loginForm')
const usernameEl = $('username')
const passwordEl = $('password')
const btn = $('loginBtn')
const note = $('note')

function nextUrl() {
  const u = new URL(location.href)
  const next = u.searchParams.get('next')
  if (next && next.startsWith('/')) return next
  return '/remote/'
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(msg || `HTTP ${res.status}`)
  }
  return await res.json()
}

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  note.textContent = ''
  btn.disabled = true
  try {
    const username = String(usernameEl.value || '')
    const password = String(passwordEl.value || '')
    await postJson('/api/remote/login', { username, password })
    location.href = nextUrl()
  } catch {
    note.textContent = '登录失败：账号或密码错误，或后端未启动。'
  } finally {
    btn.disabled = false
  }
})
