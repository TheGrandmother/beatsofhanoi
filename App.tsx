import React, { ChangeEvent } from 'react'
import {Cell, Stack, Traveler, randomStack, randomTraveler, step} from './stack'
import {el, NodeRepr_t} from '@elemaudio/core';
import WebRenderer from '@elemaudio/web-renderer';
import {useState, useEffect, useRef, useCallback} from 'react'

function cellColor(c: number) {
  const maxVal = 24
  return `rgb(${Math.floor((128 * c)/maxVal)+128},${Math.floor((255 * c)/maxVal)},56)`
}

function travelerColor(c: number, maxVal: number) {
  return `rgb(170, ${Math.floor((128 * c)/maxVal)+128},${Math.floor((255 * c)/maxVal)})`
}


function TravelerComp({index, travelers}: {index: number, travelers: Traveler[]}) {
  return (
    <div className="travelerPile">
      {travelers.filter(t => t.position === index).map((t, i) => (
        <div key={i} className="traveler">
          <div style={{backgroundColor: travelerColor(t.id, travelers.length)}} className="travelerHead"></div>
          {typeof t.carrying !== 'undefined' &&
            <div style={{backgroundColor: cellColor(t.carrying)}} className="cell" ></div>
          }
        </div>
      ))}
    </div>
  );
}


const drawStack = (s: Stack) => [...s].reverse().map((c,i) => (
  <div className="cell" style={{backgroundColor: cellColor(c)}} key={`cell_${i}`}></div>
))

function StackComp({cells}: {cells: Cell[]}) {
  return (
    <div className="stack">
      {drawStack(cells)}
    </div>
  );
}

function World({stacks, travelers}: {stacks: Stack[], travelers: Traveler[]}) {
  return (
    <div className="world">
      {
        stacks.map((s, i) => (
          <div key={i} className="column">
            <TravelerComp index={i} travelers={travelers} />
            <StackComp cells={s}/>
          </div>))
      }
    </div>
  );
}

function StackHistory({stackHistory}: {stackHistory: Stack[]}) {
  const drawRecord = (record: Stack[]) => {
    return record.map((s, i) => {
      if (s.length === 0) {
        return <div key={`history_cell_${i}`} className="cell" ></div>
      } else {
        const head = s[s.length -1]
        return <div key={`history_cell_${i}`} className="cell" style={{backgroundColor: cellColor(head)}}></div>
      }
    })
  }

  return (
    <div className="stackHistory">
      {stackHistory.map((s, i) => (
        <div key={`stack_${i}`} className="stackHistoryEntry">{
          drawRecord(s)
        }</div>
      ))}
    </div>
  );
}

function noteToHz(n: number) {
  return 220*Math.pow(2, n/12)
}

function toVoice(t: Traveler): NodeRepr_t | number {
  const isCarrying = typeof t.carrying !== "undefined"
  const gate = isCarrying ? 1.0 : 0.0
  const n = (t.carrying || t.lastCarried || 0) + Math.random()/20
  let f = noteToHz(n)
  t.lastCarried = n
  return el.mul(
    el.adsr(.1,.1,0,.1, el.const({key: `${t.id}:gate`, value: gate})),
    el.bleptriangle(el.const({key: `${t.id}:freq`, value: f}))
  )
}

const subdivs = 4

let bassNote = 0;
let bassEmph = false;
function crazyBassy(tick: number, travelers: Traveler[]) {
    const toGate = (x: boolean) => x ? 1.0 : 0.0
    const isQuarter = tick % subdivs === 0
    const isOne = tick % (subdivs * 4) === 0
    const isEigth = tick % (subdivs / 2) === 0
    let gate = false
    if (isQuarter) {
      bassNote = -12
      gate = true
      bassEmph = isOne;
    }
    const f = noteToHz(bassNote)
    return el.mul(2, el.mul(
      el.adsr(
        .01,
        0.0,
        1,
        el.const({key: 'bass:emph', value: 0.1 + (bassEmph ? 1 : 0)}),
        el.const({key: `bass:gate`, value: toGate(gate)})),
      el.bleptriangle(el.const({key: `bass:freq`, value: f}))
    ))
}

function initAudio(setCore: (core: WebRenderer) => void) {
    const ctx = new AudioContext();

    const contextStarter = () => {
      if (ctx.state === 'running') {
        removeEventListener('mouseover', contextStarter)
        removeEventListener('touchstart', contextStarter)
        console.log('ctx resumed.')
      } else {
        ctx.resume()
      }
    }

    addEventListener('mouseover', contextStarter)

    addEventListener('touchstart', contextStarter)

    const core = new WebRenderer();
    core.initialize(ctx, {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    }).then(node => node.connect(ctx.destination));

    core.on('load', function() {
      setCore(core)
    });

}


let faffTimeout : ReturnType<typeof setTimeout>;

function debounced(delay: number, fn: (...args: any[]) => any) {
  let timeout: ReturnType<typeof setTimeout>;
  const newFn = (...args: any[]) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), delay)
  }
  return newFn
}

function App() {

  const maxHistorySize = 200;

  const [stacks, setStacks] = useState<Stack[]>([])
  const [travelers, setTravelers] = useState<Traveler[]>([])
  const [started, setStarted] = useState(false)
  const [core, setCore] = useState<WebRenderer>()
  const [stackHistory, setStackHistory] = useState<Cell[][]>([])
  const [initialState, setInitialState] = useState('')
  const [count, setCount] = useState(0)
  const [cycleLength, setCycleLength] = useState(0)
  const [spedd, setSpedd] = useState(90)
  const [stackCount, setStackCount] = useState(8)
  const [travelerCount, setTravelerCount] = useState(3)
  const [plzRespawn, setPlzRespawn] = useState(true)
  const [bassItOut, setBassItOut] = useState(true)

  useEffect(() => {
    initAudio(setCore)
    respawn(true, true, stackCount, travelerCount)
  },[])

  useEffect(() => {
    const stringyStacks = JSON.stringify(stacks)
    if (JSON.stringify([stacks, travelers.map(t => [t.position, t.carrying])]) === initialState && count > 2 && !cycleLength) {
      setCycleLength(count)
    }
    if (JSON.stringify(stackHistory[stackHistory.length -1]) !== stringyStacks) {
      let newStory = [...stackHistory, JSON.parse(stringyStacks)]
      if (newStory.length > maxHistorySize) {
        newStory = newStory.slice(1)
      }
      setStackHistory(newStory)
      setCount(count + 1)
    }
  }, [stacks, travelers, stackHistory, count, cycleLength])


  const onSpeddChange = useCallback(debounced(500, (e: ChangeEvent<HTMLInputElement>) => {
    setSpedd(parseInt(e.target.value))
    setPlzRespawn(true)
  }), [])

  const changeStackCount = useCallback(debounced(100, (e: ChangeEvent<HTMLInputElement>) => {
    setStackCount(parseInt(e.target.value))
    setPlzRespawn(true)
  }), [])

  const changeTravelerCount = useCallback(debounced(100, (e: ChangeEvent<HTMLInputElement>) => {
    setTravelerCount(parseInt(e.target.value))
    setPlzRespawn(true)
  }), [])

  useEffect(() => {
    if (plzRespawn) {
      clearTimeout(faffTimeout)
      const newStacks = Array(stackCount).fill(0).map(() => randomStack(1,1))
      const newTraverlers = Array(travelerCount).fill(0).map((_,i) => randomTraveler(stackCount,i,i))
      if (travelers.length !== 0) {
        newTraverlers.forEach((t,i) => t.carrying = travelers[i]?.carrying)
      }
      setStackHistory([])
      setStacks(newStacks)
      setInitialState(JSON.stringify([newStacks, newTraverlers.map(t => t.position)]))
      setInitialState(JSON.stringify([newStacks, newTraverlers.map(t => [t.position, t.carrying])]))
      setTravelers(newTraverlers)
      setCount(0)
      setCycleLength(0)
      setStarted(false)
      setPlzRespawn(false)

    }
  }, [plzRespawn, stackCount, travelerCount])

  const respawn = (doStacks: boolean, doTravelers: boolean, stackCount: number, travelerCount: number) => {
    clearTimeout(faffTimeout)
    const newStacks = doStacks ? Array(stackCount).fill(0).map(() => randomStack(1,1)) : stacks
    const newTraverlers = doTravelers ? Array(travelerCount).fill(0).map((_,i) => randomTraveler(stackCount,i,i)) : travelers
    if (doTravelers && travelers.length !== 0) {
      newTraverlers.forEach((t,i) => t.carrying = travelers[i].carrying)
    }
    if (doStacks || doTravelers) {
      setStackHistory([])
      setStacks(newStacks)
      setInitialState(JSON.stringify([newStacks, newTraverlers.map(t => [t.position, t.carrying])]))
      setTravelers(newTraverlers)
      setCount(0)
      setCycleLength(0)
    }
    setStarted(false)
  }


  useEffect(() => {
    if (!started && stacks.length !== 0 && travelers.length !== 0 && core) {
      let tick = 0;
      const faff = () => {
        travelers.map(traveler => step(stacks.length, stacks[traveler.position % stacks.length], traveler))
        setStacks([...stacks])
        setTravelers([...travelers])
        const voices = travelers.map(t => toVoice(t))
        if (core) {
          const bass = bassItOut ? crazyBassy(tick, travelers): el.const({value: 0.0})
          core!.render(
            el.mul(el.const({value: 0.5 * 1/(voices.length + 1)}), el.add(...voices, bass)),
            el.mul(el.const({value: 0.5 * 1/(voices.length + 1)}), el.add(...voices, bass))
          )
        }
        tick++;
        faffTimeout = setTimeout(() => faff(), (60/spedd)*(1000/subdivs))
      }
      faff()
      setStarted(true)
    }
  }, [stacks, travelers, started, core, spedd, stackCount, bassItOut])

  function nukeIt(stacks: boolean, travelers: boolean) {
    stacks && setStacks([])
    travelers && setTravelers([])
    setPlzRespawn(true)
  }

  function toggleBass() {
    setBassItOut(!bassItOut)
    setPlzRespawn(true)
  }

  return (
    <div className="meh">
      <div className="config">
        <World stacks={stacks} travelers={travelers}/>
        <button onClick={() => nukeIt(true, true)}>respawn</button>
        <button onClick={() => nukeIt(true, false)}>Respawn stacks</button>
        <button onClick={() => nukeIt(false, true)}>Respawn travelers</button>
        <button onClick={() => toggleBass()}>{bassItOut ? 'debass' : 'rebass'}</button>
        <div className="control">
          <span>tempo</span>
          <input onChange={(t) => onSpeddChange(t)} type="range" min="0" max="280" defaultValue={spedd}/>
          <span>{spedd}bpm</span>
        </div>
        <div className="control">
          <span>stacks</span>
          <input onChange={(t) => changeStackCount(t)} type="range" min="2" max="32" defaultValue={stackCount}/>
          <span>{stackCount}</span>
        </div>
        <div className="control">
          <span>travelers</span>
          <input onChange={(t) => changeTravelerCount(t)} type="range" min="1" max="8" defaultValue={travelerCount}/>
          <span>{travelerCount}</span>
        </div>
        {cycleLength !== 0 &&
          <span>{`repeats after ${cycleLength} notes`}</span>
        }
      </div>
      <StackHistory stackHistory={stackHistory} />
    </div>
  );
}

export default App;
