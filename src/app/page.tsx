import { redirect } from 'next/navigation'

export default function Home() {
  // O proxy cuida de mandar para /login se não houver sessão.
  redirect('/dashboard')
}
