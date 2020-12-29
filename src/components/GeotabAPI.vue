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
              placeholder="Type or search method name e.g. ExceptionEvent"
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
  const GeotabApi = require("mg-api-node");
  const api = new GeotabApi("mirandao@rushenterprises.com", "105Norma105!", "rush");
  const axios = require("axios");
  const refGeotab = "https://my967.geotab.com/apiv1";
  var elasticsearch = require("elasticsearch");

  var elasticClient = new elasticsearch.Client({
    host: "localhost:9200",
  });

  export default {
    name: "GeotabAPI",
    methods: {
      chunkArray(myArray) {
        var index = 0;
        var arrayLength = myArray.length;
        var tempArray = [];

        for (index = 0; index < arrayLength; index += parseInt(this.deviceLimit)) {
          var myChunk = myArray.slice(index, index + parseInt(this.deviceLimit));
          tempArray.push(myChunk);
        }

        return tempArray;
      },
      addToElastic() {
        for (var i = 0; i < this.data.length; i++) {
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
            });
        }
        this.success = true;
        this.successMessage = "Data uploaded successfully";
        this.loadingElastic = false;
        this.buttonMessage = "No data to upload";
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
            }
          });
      },

      getData() {
        this.data = [];
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: this.methodName,
              search: {
                name: data.userName,
                fromUtc: this.fromDate.toISOString(),
                toUtc: this.toDate.toISOString(),
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
                reportArgumentType: "RouteComparisonDetailReport",
                deviceSearch: this.deviceId[5],
                defects: {},
                userSearch: this.users,
              },
            },
            (err, data) => {
              if (err) {
                console.log("Error", err);
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = err;
                return;
              }
              this.data = data;
              console.log("Data: ", data);
            }
          );
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
          "ExceptionEvent",
          "DutyStatusLog",
          "ShipmentLog",
          "TextMessage",
          "Audit",
          "Route",
          "Zone",
          "LogRecord",
          "FuelTaxDetail",
          "DVIRLog",
          "TrailerAttachment",
          "DeviceStatusInfo",
          "GetReportData",
          "Trailer",
          "Rule",
          "Diagnostic",
          "Device",
          "User",
          "Group",
        ],
        fromDate: new Date(),
        toDate: new Date(),
        password: "105Norma105!",
        username: "mirandao@rushenterprises.com",
        loading: false,
        loadingData: false,
        loadingElastic: false,
        success: false,
        successMessage: "",
        info: false,
        infoMessage: "",
        error: false,
        errorCode: null,
        notificationDuration: 4000,
        data: null,
        apiKey: "",
        sessionId: "",
        account: "RUSH01",
        buttonMessage: "No data to upload",
        status: "",
        progress: 0,
        parts: 100 / 2,
        methodName: "",
        indexName: "",
        typeName: "",
        deviceId: [],
        devices: [],
        allUsers: [],
        users: [],
      };
    },

    created() {
      axios
        .post(refGeotab, {
          method: "Authenticate",
          params: {
            userName: this.username,
            password: this.password,
          },
        })
        .then((response) => {
          this.sessionIdGeo = response.data.result.credentials.sessionId;
        })
        .catch((error) => {
          console.log(error);
        });

      api.authenticate((err, data) => {
        api.call(
          "Get",
          {
            typeName: "Device",
            search: {
              name: data.userName,
            },
          },
          (err, data) => {
            if (err) {
              console.log("Error", err);
            }
            this.devices = data;
            data.forEach((element) => {
              var id = element.id;
              var item = {};
              item["id"] = id;
              this.deviceId.push(item);
            });
          }
        );
      });

      api.authenticate((err, data) => {
        api.call(
          "Get",
          {
            typeName: "User",
            search: {
              name: data.userName,
            },
          },
          (err, data) => {
            if (err) {
              console.log("Error", err);
            }
            this.allUsers = data;
            data.forEach((element) => {
              var id = element.id;
              var item = {};
              item["id"] = id;
              this.users.push(item);
            });
            console.log(this.users);
          }
        );
      });
    },
  };
</script>
