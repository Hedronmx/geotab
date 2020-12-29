import Vue from 'vue'
import App from './App.vue'
import Buefy from 'buefy'
import 'buefy/dist/buefy.css'
import VueRouter from 'vue-router'
Vue.use(Buefy)
Vue.use(VueRouter)

import Routes from './Routes';

const router = new VueRouter ({
  linkActiveClass: "is-active",
  linkExactActiveClass: "is-active",
  mode: 'history',
  routes: Routes,
})

Vue.config.productionTip = false

new Vue({
  router,
  render: h => h(App),
}).$mount('#app')
