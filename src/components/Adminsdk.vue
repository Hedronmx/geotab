<template>
  <section style="padding: 12px">
    <div class="container">
      <div class="columns">
        <div class="column">
          <b-field label="Method Name">
            <b-autocomplete
              rounded
              v-model="methodName"
              :data="filteredDataArray"
              placeholder="Type or search method name e.g. GetOwnDatabases"
              icon="magnify"
              clearable
              @select="(option) => (selected = option)"
            >
              <template slot="empty">No results found</template>
            </b-autocomplete>
          </b-field>
          <b-field label="From Date">
            <b-datepicker
              v-model="fromDate"
              placeholder="From Date..."
              icon="calendar-today"
              trap-focus
            >
            </b-datepicker>
          </b-field>
          <b-field label="To Date">
            <b-datepicker
              v-model="toDate"
              placeholder="To Date..."
              icon="calendar-today"
              trap-focus
            >
            </b-datepicker>
          </b-field>
          <b-button type="is-info" @click="getData" :loading="loadingData" expanded
            >Get Data!</b-button
          >
        </div>
      </div>
    </div>
    <div class="container pt-4">
      <b-field label="Index Name">
        <b-input placeholder="Type the index name" v-model="indexName"></b-input>
      </b-field>
      <b-field label="Type Name">
        <b-input placeholder="Type the type name" v-model="typeName"></b-input>
      </b-field>
      <b-button
        style="margin-top: 10px"
        type="is-success"
        @click="createIndex"
        expanded
        :loading="loadingElastic"
        :disabled="checkInputs"
        >{{ buttonMessage }}</b-button
      >
      <b-progress
        style="margin-top: 10px"
        type="is-info"
        v-if="loadingElastic"
        :value="progress"
        size="is-large"
        show-value
      >
        {{ status }}
      </b-progress>
    </div>
    <div class="container pt-4">
      <b-notification
        type="is-danger"
        position="is-top"
        v-model="error"
        has-icon
        aria-close-label="Close notification"
      >
        <h2>Error: {{ errorCode }}</h2>
      </b-notification>
      <b-notification
        auto-close
        :duration="notificationDuration"
        type="is-info"
        position="is-top"
        v-model="info"
        has-icon
        aria-close-label="Close notification"
      >
        <h2>{{ infoMessage }}</h2>
      </b-notification>
      <b-notification
        type="is-success"
        position="is-top"
        v-model="success"
        has-icon
        aria-close-label="Close notification"
      >
        <h2>{{ successMessage }}</h2>
      </b-notification>
    </div>
  </section>
</template>

<script>
  const axios = require("axios");
  const ref = "https://myadminapi.geotab.com/v2/MyAdminApi.ashx";
  var elasticsearch = require("elasticsearch");
  const moment = require("moment");

  var elasticClient = new elasticsearch.Client({
    host: "localhost:9200",
  });

  export default {
    name: "Adminsdk",
    methods: {
      addToElastic() {
        var promises = [];
        for (var i = 0; i < this.data.length; i++) {
          promises.push(
            elasticClient
              .index({
                index: this.indexName.toLowerCase(),
                type: this.typeName.toLowerCase(),
                body: this.data[i],
              })
              .then((response) => {
                console.log(response);
                this.progress = this.progress + 1;
                this.status = "Uploading " + i + " of " + this.data.length;
              })
              .catch((error) => {
                console.log(error);
                this.error = true;
                this.errorCode = error;
                this.loadingElastic = false;
                this.buttonMessage = "No data to upload";
                this.data = [];
              })
          );
        }
        Promise.all(promises).then(() => {
          this.success = true;
          this.successMessage = "Data uploaded successfully";
          this.loadingElastic = false;
          this.buttonMessage = "No data to upload";
          this.data = [];
        });
      },

      addToElasticSingle() {
        var promises = [];
        for (var i = 0; i < this.data.length; i++) {
          promises.push(
            elasticClient
              .index({
                index: this.indexName.toLowerCase(),
                type: this.typeName.toLowerCase(),
                body: {
                  name: this.data[i],
                },
              })
              .then((response) => {
                console.log(response);
                this.progress = this.progress + 1;
                this.status = "Uploading " + i + " of " + this.data.length;
              })
              .catch((error) => {
                console.log(error);
                this.error = true;
                this.errorCode = error;
                this.loadingElastic = false;
                this.buttonMessage = "No data to upload";
                this.data = [];
              })
          );
        }

        Promise.all(promises).then(() => {
          this.success = true;
          this.successMessage = "Data uploaded successfully";
          this.loadingElastic = false;
          this.buttonMessage = "No data to upload";
          this.data = [];
          promises = [];
        });
      },

      createIndex() {
        this.loadingElastic = true;
        this.status = "Creating Index";
        this.progress = 0;
        elasticClient.indices
          .create({
            index: this.indexName,
          })
          .then((reponse) => {
            console.log(reponse);
            this.infoMessage = "Created " + this.indexName + " index. Uploading content";
            this.info = true;
            if (this.methodName == "GetOwnDatabases") {
              this.addToElasticSingle();
            } else {
              this.addToElastic();
            }
            this.progress = 1;
          })
          .catch((error) => {
            console.log(error);
            if (error.statusCode == 400) {
              this.infoMessage = "Index already exists, uploading content";
              this.info = true;
              this.addToElastic();
            } else {
              this.error = true;
              this.errorCode = error.message;
              this.loadingElastic = false;
              this.buttonMessage = "No data to upload";
              this.data = [];
            }
          });
      },
      getData() {
        this.loadingData = true;
        this.success = false;
        this.error = false;
        this.info = false;
        this.data = [];
        axios
          .post(ref, {
            method: this.methodName,
            params: {
              apiKey: this.apiKey,
              sessionId: this.sessionId,
              forAccount: this.account,
              userEmail: this.account,
              fromDate: this.fromDate.toISOString(),
              toDate: this.toDate.toISOString(),
              monthFilter: moment(this.fromDate).month(),
              yearFilter: moment(this.fromDate).year(),
              ticketTokens: "",
            },
          })
          .then((response) => {
            console.log(response);
            this.loadingData = false;
            this.data = response.data.result;
            this.success = true;
            this.buttonMessage = "Upload data to ElasticSearch";
            this.successMessage =
              "Got data succesfully from method " +
              this.methodName +
              ", got " +
              response.data.result.length +
              " items";
          })
          .catch((error) => {
            console.log(error);
            this.loadingData = false;
            this.error = true;
            this.success = false;
            this.errorCode = error;
          });
      },
    },

    computed: {
      checkInputs() {
        var disabled = null;
        if (this.indexName.length > 0 && this.typeName.length > 0 && this.data.length > 0) {
          disabled = false;
        } else {
          disabled = true;
        }
        return disabled;
      },
      filteredDataArray() {
        return this.methods.filter((option) => {
          return (
            option
              .toString()
              .toLowerCase()
              .indexOf(this.methodName.toLowerCase()) >= 0
          );
        });
      },
    },

    data() {
      return {
        methods: [
          "GetOwnDatabases",
          "GetCurrentDeviceDatabases",
          "GetInstallLogs",
          "GetDevicePlans",
          "GetSupportTickets",
          "GetSupportTicketDetails",
        ],
        fromDate: new Date(),
        toDate: new Date(),
        password: "105Norma105!",
        username: "mirandao@rushenterprises.com",
        account: "RUSH01",
        loadingData: false,
        loadingElastic: false,
        disabled: true,
        success: false,
        info: false,
        error: false,
        errorCode: null,
        apiKey: "",
        sessionId: "",
        status: "",
        progress: 0,
        methodName: "",
        indexName: "",
        typeName: "",
        successMessage: "",
        infoMessage: "",
        data: [],
        notificationDuration: 4000,
        buttonMessage: "No data to upload",
      };
    },

    created() {
      axios
        .post(ref, {
          method: "Authenticate",
          params: {
            username: this.username,
            password: this.password,
          },
        })
        .then((response) => {
          this.sessionId = response.data.result.sessionId;
          this.apiKey = response.data.result.userId;
        })
        .catch((error) => {
          console.log(error);
        });
    },
  };
</script>
