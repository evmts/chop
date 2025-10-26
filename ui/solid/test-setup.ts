import '@testing-library/jest-dom'
import { cleanup } from '@solidjs/testing-library'
import { afterEach } from 'vitest'

// Cleanup after each test
afterEach(() => {
	cleanup()
	localStorage.clear()
})

// Mock window APIs that might not be available in test environment
global.localStorage = {
	getItem: (key: string) => {
		return (global as any)[`__localStorage_${key}`] || null
	},
	setItem: (key: string, value: string) => {
		(global as any)[`__localStorage_${key}`] = value
	},
	removeItem: (key: string) => {
		delete (global as any)[`__localStorage_${key}`]
	},
	clear: () => {
		Object.keys(global).forEach((key) => {
			if (key.startsWith('__localStorage_')) {
				delete (global as any)[key]
			}
		})
	},
	length: 0,
	key: () => null,
}
