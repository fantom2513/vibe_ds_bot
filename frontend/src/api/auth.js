export async function getMe() {
  const res = await fetch('/auth/me')
  if (!res.ok) return null
  return res.json()
}

export async function logout() {
  await fetch('/auth/logout', { method: 'POST' })
}
