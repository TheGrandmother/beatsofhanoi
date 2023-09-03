export type Cell = any

// type Action = "swap" | "exchange"

export interface Traveler {
  id: number,
  condition: (c1?: Cell, c2?: Cell) => boolean,
  yesAction: (stack: Stack, traveler: Traveler) => void,
  noAction: (stack: Stack, traveler: Traveler) => void,
  position: number,
  carrying: Cell | undefined,
  lastCarried?: Cell,
  waitSteps: number,
  waiting: number,
  onPickup: (x: Cell) => void,
  onDrop: (x: Cell) => void,
}

export type Stack = Cell[]

function is_undef(x: any) {
  if (typeof x === "undefined") {
    return true
  }
  return false
}

function gt(carried?: Cell, onStack?: Cell): boolean{
  if (is_undef(carried)) {
    return true
  }
  if (is_undef(carried) && is_undef(onStack)) {
    return false
  }
  if (is_undef(carried) && !is_undef(onStack)) {
    return false
  }
  return carried > onStack
}

function lt(carried?: Cell, onStack?: Cell): boolean{
  if (is_undef(carried)) {
    return true
  }
  if (is_undef(carried) && is_undef(onStack)) {
    return true
  }
  if (is_undef(carried) && !is_undef(onStack)) {
    return true
  }
  return carried < onStack
}

// function doSwap(stack: Stack, traveler: Traveler) {
//   if (!is_undef(traveler.carrying)) {
//     const swap = stack.pop()
//     stack.push(traveler.carrying)
//     traveler.carrying = swap
//   } else {
//     const a = stack.pop()
//     const b = stack.pop()
//     a && stack.push(a)
//     b && stack.push(b)
//   }
// }

function doExchange(stack: Stack, traveler: Traveler) {
  if (!is_undef(traveler.carrying)) {
    stack.push(traveler.carrying)
    traveler.onDrop(traveler.carrying)
    traveler.carrying = undefined
  } else {
    traveler.carrying = stack.pop()
    traveler.onPickup(traveler.carrying)
  }
}

function doFuckall(..._args: any[]) {}

export function step(worldLength: number, stack: Stack, traveler: Traveler) {
  if (traveler.waiting) {
    traveler.waiting -= 1
    return
  }
  traveler.position = (traveler.position + 1) % worldLength
  traveler.waiting = traveler.waitSteps

  let c1 = stack[stack.length - 1]
  let c2 = stack[stack.length - 2]
  const isEmpty = traveler.carrying === undefined && c1 !== undefined
  const canDeposit = traveler.carrying !== undefined && c1 === undefined && c2 === undefined
  if (isEmpty || canDeposit) {
    doExchange(stack, traveler)
  } else {
    if (traveler.carrying !== undefined) {
      c2 = c1
      c1 = traveler.carrying
    }
    const condy_boi = traveler.condition(c1, c2)
    if (condy_boi) {
      traveler.yesAction(stack, traveler)
    } else {
      traveler.noAction(stack, traveler)
    }
  }

}


export function oldStep(worldLength: number, stack: Stack, traveler: Traveler) {
  if (traveler.waiting) {
    traveler.waiting -= 1
    return
  }
  let c1: Cell
  let c2: Cell
  if (!is_undef(traveler.carrying)) {
    c1 = traveler.carrying
    c2 = stack[stack.length - 1]
  } else {
    c1 = stack[stack.length - 1]
    c2 = stack[stack.length - 2]
  }
  const condy_boi = traveler.condition(c1, c2)
  if (condy_boi) {
    traveler.yesAction(stack, traveler)
  } else {
    traveler.noAction(stack, traveler)
  }
  traveler.position = (traveler.position + 1) % worldLength
  traveler.waiting = traveler.waitSteps

}


function randomCell() {
  return Math.floor(Math.random() * 12)
}

function randomIonian() {
  const i = Math.floor(Math.random() * 7)
  const note = [0,2,4,5,7,9,11][i]
  if (Math.random() > .5) {
    return note
  } else {
    return note + 12
  }
}


export function randomStack(min: number, max: number) {
  const length = Math.floor(min + Math.random() * (max - min))
  return Array(length).fill(0).map(_ => randomIonian())
}

export function randomTraveler(max_pos: number, wait: number, id: number) {
  const cf = () => Math.random() > 0.5
  const meh =  cf()
  return {
    id,
    position: Math.floor(Math.random() * max_pos),
    noAction: doFuckall,
    yesAction: doExchange,
    condition: cf() ? gt : lt,
    carrying: undefined,
    waitSteps: wait,
    waiting: 0,
    // onPickup: (x: Cell) => {output.sendMessage([0x90 + c ,x+64,1])},
    // onDrop: (x: Cell) => {output.sendMessage([0x80 + c ,x+64,1])}
    onPickup: () => {},
    onDrop: () => {}
  }
}
