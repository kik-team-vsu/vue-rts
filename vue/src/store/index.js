import { createStore } from 'vuex'
import game from './game'
import world from './world'
import selection from './selection'

export default createStore({
  modules: {
    game,
    world,
    selection,
  },
})
