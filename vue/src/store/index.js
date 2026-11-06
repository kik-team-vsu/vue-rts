import { createStore } from 'vuex'
import game from './game'
import world from './world'
import selection from './selection'
import camera from './camera'
import engine from './engine'

export default createStore({
  modules: {
    game,
    world,
    selection,
    camera,
    engine,
  },
})
