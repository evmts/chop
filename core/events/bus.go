package events

import (
	"sync"
	"time"

	"chop/types"
)

// Handler is a function that handles events
type Handler func(event types.BlockchainEvent)

// Bus is a simple event bus for publishing and subscribing to blockchain events
type Bus struct {
	subscribers map[types.EventType][]Handler
	mu          sync.RWMutex
}

// NewBus creates a new event bus
func NewBus() *Bus {
	return &Bus{
		subscribers: make(map[types.EventType][]Handler),
	}
}

// Subscribe registers a handler for a specific event type
func (b *Bus) Subscribe(eventType types.EventType, handler Handler) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.subscribers[eventType] == nil {
		b.subscribers[eventType] = []Handler{}
	}

	b.subscribers[eventType] = append(b.subscribers[eventType], handler)
}

// SubscribeAll registers a handler for all event types
func (b *Bus) SubscribeAll(handler Handler) {
	b.Subscribe(types.EventNewBlock, handler)
	b.Subscribe(types.EventNewTransaction, handler)
	b.Subscribe(types.EventAccountUpdated, handler)
	b.Subscribe(types.EventContractDeployed, handler)
	b.Subscribe(types.EventStateChanged, handler)
}

// Publish publishes an event to all subscribers
func (b *Bus) Publish(eventType types.EventType, data interface{}) {
	b.mu.RLock()
	handlers := b.subscribers[eventType]
	b.mu.RUnlock()

	event := types.BlockchainEvent{
		Type:      eventType,
		Timestamp: time.Now(),
		Data:      data,
	}

	// Call all handlers in goroutines to avoid blocking
	for _, handler := range handlers {
		go handler(event)
	}
}

// PublishNewBlock publishes a new block event
func (b *Bus) PublishNewBlock(block *types.Block) {
	b.Publish(types.EventNewBlock, block)
}

// PublishNewTransaction publishes a new transaction event
func (b *Bus) PublishNewTransaction(tx *types.Transaction) {
	b.Publish(types.EventNewTransaction, tx)
}

// PublishAccountUpdated publishes an account updated event
func (b *Bus) PublishAccountUpdated(account *types.Account) {
	b.Publish(types.EventAccountUpdated, account)
}

// PublishContractDeployed publishes a contract deployed event
func (b *Bus) PublishContractDeployed(contract *types.Contract) {
	b.Publish(types.EventContractDeployed, contract)
}

// PublishStateChanged publishes a state changed event
func (b *Bus) PublishStateChanged(data interface{}) {
	b.Publish(types.EventStateChanged, data)
}

// Clear removes all subscribers
func (b *Bus) Clear() {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.subscribers = make(map[types.EventType][]Handler)
}

// GetSubscriberCount returns the number of subscribers for an event type
func (b *Bus) GetSubscriberCount(eventType types.EventType) int {
	b.mu.RLock()
	defer b.mu.RUnlock()

	return len(b.subscribers[eventType])
}
