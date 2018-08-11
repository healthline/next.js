import React, { Component } from 'react'
import { getDisplayName } from './utils'

export default function withSideEffect (reduceComponentsToState, handleStateChangeOnClient) {
  return function wrap (WrappedComponent) {
    let mountedInstances = []
    let state

    function emitChange (component) {
      state = reduceComponentsToState(mountedInstances)

      if (SideEffect.canUseDOM) {
        handleStateChangeOnClient.call(component, state)
      }
    }

    class SideEffect extends Component {
      // Try to use displayName of wrapped component
      static displayName = `SideEffect(${getDisplayName(WrappedComponent)})`

      // Expose canUseDOM so tests can monkeypatch it
      static canUseDOM = typeof window !== 'undefined'

      static peek () {
        return state
      }

      static rewind () {
        if (process.env.NODE_ENV !== 'production' && SideEffect.canUseDOM) {
          throw new Error('You may only call rewind() on the server. Call peek() to read the current state.')
        }

        const recordedState = state
        state = undefined
        mountedInstances = []
        return recordedState
      }

      componentWillMount () {
        mountedInstances.push(this)
        emitChange(this)
      }

      componentDidUpdate () {
        emitChange(this)
      }

      componentWillUnmount () {
        const index = mountedInstances.indexOf(this)
        if (index >= 0) {
          mountedInstances.splice(index, 1)
        }
        emitChange(this)
      }

      render () {
        return <WrappedComponent>{ this.props.children }</WrappedComponent>
      }
    }

    return SideEffect
  }
}
