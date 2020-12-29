<template>
  <b-navbar v-bind:centered="true">
    <template slot="start">
      <b-navbar-item tag="router-link" :to="{ path: '/' }" exact>
        MyAdminSDK
      </b-navbar-item>
      <b-navbar-item tag="router-link" :to="{ path: '/geotab' }">
        Geotab API
      </b-navbar-item>
    </template>
  </b-navbar>
</template>
<script>
  export default {
    name: "Navbar",
  };
</script>
