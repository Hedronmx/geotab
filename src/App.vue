<template>
  <div id="app">
    <Navbar />
    <router-view></router-view>
  </div>
</template>

<script>
  import Navbar from "./components/Navbar.vue";
  var elasticsearch = require("elasticsearch");
  var elasticClient = new elasticsearch.Client({
    host: "localhost:9200",
    log: "info",
  });
  export default {
    name: "App",
    components: {
      Navbar,
    },
    created() {
      elasticClient.ping(
        {
          requestTimeout: 32000,
        },
        function(error) {
          if (error) {
            console.error("Elasticsearch cluster is down!");
          } else {
            console.log("Connected to Elasticsearch");
          }
        }
      );
    },
  };
</script>

<style>
  #app {
    font-family: Inter, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: center;
    color: #2c3e50;
    margin-top: 60px;
  }
</style>
