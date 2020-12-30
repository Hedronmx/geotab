<template>
  <section style="padding: 12px">
    <div class="container">
      <div class="columns">
        <div class="column">
          <b-loading :is-full-page="true" v-model="loading" :can-cancel="false"></b-loading>
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
          <b-field label="Database Name">
            <b-input placeholder="Type the database name" v-model="database"></b-input>
          </b-field>
          <b-field label="Device Limit">
            <b-numberinput
              type="is-light"
              placeholder="Type the amount of devices to proccess"
              v-model="deviceLimit"
            ></b-numberinput>
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
        elasticClient
          .bulk({
            maxRetries: 5,
            index: this.indexName.toLowerCase(),
            type: this.typeName.toLowerCase(),
            body: this.data,
          })
          .then((response) => {
            console.log(response);
            this.success = true;
            this.successMessage = "Data uploaded successfully";
            this.loadingElastic = false;
            this.buttonMessage = "No data to upload";
          })
          .catch((error) => {
            console.log(error);
            this.error = true;
            this.errorCode = error;
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
            this.addToElastic();
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
        this.loadingData = true;
        this.success = false;
        this.error = false;
        this.info = false;
        this.chunks = this.chunkArray(this.deviceId);
        var promises = [];
        if (this.methodName == "GetReportData") {
          for (var i = 0; i < this.chunks.length; i++) {
            promises.push(
              axios
                .post(refGeotab, {
                  method: "GetReportData",
                  params: {
                    argument: {
                      fromUtc: this.fromDate.toISOString(),
                      toUtc: this.toDate.toISOString(),
                      reportArgumentType: "RouteComparisonDetailReport",
                      devices: this.chunks[i],
                    },
                    credentials: {
                      database: this.database,
                      sessionId: this.sessionIdGeo,
                      userName: this.username,
                    },
                  },
                })
                .then((response) => {
                  if (response.data.result.length > 0) {
                    this.results.push(response.data.result);
                    console.log(response.data.result);
                  }
                })
                .catch((error) => {
                  console.log(error);
                  this.loading = false;
                  this.error = true;
                  this.success = false;
                  this.errorCode = error;
                })
            );
          }
          Promise.all(promises).then(() => {
            for (var i = 0; i < this.results.length; i++) {
              this.data = this.data.concat(this.results[i]);
            }
            promises = [];
            this.results = [];
            console.log(this.data);
            this.loadingData = false;
            this.success = true;
            this.successMessage =
              "Got data succesfully from method " +
              this.methodName +
              ", got " +
              this.data.length +
              " items";
          });
        } else if (
          this.methodName == "Device" ||
          this.methodName == "Group" ||
          this.methodName == "User" ||
          this.methodName == "Device" ||
          this.methodName == "Trailer" ||
          this.methodName == "Rule" ||
          this.methodName == "Diagnostic"
        ) {
          api.authenticate((err, data) => {
            api.call(
              "Get",
              {
                typeName: this.methodName,
                search: {
                  name: data.userName,
                },
              },
              (err, data) => {
                if (err) {
                  console.log("Error", err);
                  this.loadingData = false;
                  this.error = true;
                  this.success = false;
                  this.errorCode = err;
                  return;
                }
                if (data.length > 0) {
                  this.data = data;
                  console.log(this.data);
                  this.loadingData = false;
                  this.success = true;
                  this.successMessage =
                    "Got data succesfully from method " +
                    this.methodName +
                    ", got " +
                    this.data.length +
                    " items";
                }
              }
            );
          });
        } else {
          api.authenticate((err, data) => {
            for (var i = 0; i < this.chunks.length; i++) {
              promises.push(
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
                      deviceSearch: {
                        id: this.chunks[i].id,
                      },
                      userSearch: {
                        id: this.users[i],
                      },
                    },
                  },
                  (err, data) => {
                    if (err) {
                      console.log("Error", err);
                      this.loadingData = false;
                      this.error = true;
                      this.success = false;
                      this.errorCode = err;
                      return;
                    }
                    if (data.length > 0) {
                      this.results.push(data);
                      console.log(data);
                    }
                  }
                )
              );
            }
            Promise.all(promises).then(() => {
              promises = [];
              for (var i = 0; i < this.results.length; i++) {
                this.data = this.data.concat(this.results[i]);
              }
              console.log(this.data);
              this.results = [];
              this.loadingData = false;
              this.success = true;
              this.successMessage =
                "Got data succesfully from method " +
                this.methodName +
                ", got " +
                this.data.length +
                " items";
            });
          });
        }
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
        database: "ccswb",
        loading: true,
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
        deviceLimit: 10,
        methodName: "",
        indexName: "",
        typeName: "",
        deviceId: [],
        devices: [],
        allUsers: [],
        users: [],
        chunks: [],
        results: [],
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
            for (var i = 0; i < this.devices.length; i++) {
              var item = {};
              item["id"] = this.devices[i].id;
              this.deviceId[i] = item;
            }
            console.log("Device ids: ", this.deviceId);
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
            for (var i = 0; i < this.allUsers.length; i++) {
              this.users[i] = this.allUsers[i].id;
            }
            console.log("User ids: ", this.users);
            this.loading = false;
          }
        );
      });
    },
  };
</script>
