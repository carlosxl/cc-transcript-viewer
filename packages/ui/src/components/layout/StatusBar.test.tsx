import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { StatusBar } from './StatusBar'

afterEach(() => {
  cleanup()
})

describe('StatusBar', () => {
  it('renders the keyboard hints', () => {
    render(<StatusBar current={1} total={10} />)
    expect(screen.getByText('j')).toBeInTheDocument()
    expect(screen.getByText('k')).toBeInTheDocument()
    expect(screen.getByText('/')).toBeInTheDocument()
    expect(screen.getByText('⌘K')).toBeInTheDocument()
    expect(screen.getByText('t')).toBeInTheDocument()
    expect(screen.getByText('Esc')).toBeInTheDocument()
    expect(screen.getByText('r')).toBeInTheDocument()
    expect(screen.getByText('report')).toBeInTheDocument()
  })

  it('renders the current/total counter', () => {
    render(<StatusBar current={3} total={42} />)
    expect(screen.getByText(/msg 3 \/ 42/)).toBeInTheDocument()
  })

  it('shows an em-dash when current is null', () => {
    render(<StatusBar current={null} total={42} />)
    expect(screen.getByText(/msg — \/ 42/)).toBeInTheDocument()
  })
})
