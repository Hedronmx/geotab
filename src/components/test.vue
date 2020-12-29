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

      getGeotabGroups() {
        this.status = "Getting Geotab groups...";
        this.progress += this.parts;
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "Group",
              search: {
                name: data.userName,
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
              this.groups = data;
              console.log("Groups: ", data);
              this.getGeotabUsers();
            }
          );
        });
      },

      getGeotabUsers() {
        this.status = "Getting Geotab users...";
        this.progress += this.parts;
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
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = err;
                return;
              }
              this.users = data;
              console.log("Users: ", this.users);
              this.getGeotabDiagnostics();
            }
          );
        });
      },

      getGeotabDevice() {
        this.status = "Getting Geotab device...";
        this.loading = true;
        this.progress += this.parts;
        this.createIndex("geotabdevices");
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "Device",
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
              this.devices = data;
              for (var i = 0; i < this.devices.length; i++) {
                this.addToElastic("geotabdevices", "geotabdevice", this.devices[i]);
              }
              Promise.all([this.allPromises]).then(() => {
                this.loading = false;
                this.allPromises = [];
                this.chunks = this.chunkArray(this.devices);
              });
            }
          );
        });
      },

      getGeotabDiagnostics() {
        this.status = "Getting Geotab diagnostics...";
        this.progress += this.parts;
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "Diagnostic",
              search: {
                name: data.userName,
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
              this.diagnostics = data;
              console.log("Diagnostics: ", this.diagnostics);
              this.getGeotabRules();
            }
          );
        });
      },

      getGeotabRules() {
        this.status = "Getting Geotab rules...";
        this.progress += this.parts;
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "Rule",
              search: {
                name: data.userName,
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
              this.rules = data;
              console.log("Rules: ", this.rules);
              this.getGeotabTrailers();
            }
          );
        });
      },

      getGeotabTrailers() {
        this.status = "Getting Geotab rules...";
        this.progress += this.parts;
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "Trailer",
              search: {
                name: data.userName,
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
              this.trailers = data;
              console.log("Trailers: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },

      getReportData() {
        this.status = "Getting report data...";
        this.getMoreDevices(0);
        this.createIndex("reportdata");
        console.log(this.devicesId);
        axios
          .post(refGeotab, {
            method: "GetReportData",
            params: {
              argument: {
                fromUtc: this.fromDate.toISOString(),
                toUtc: this.toDate.toString(),
                reportArgumentType: "RouteComparisonDetailReport",
                devices: this.devicesId,
              },
              credentials: {
                database: this.databaseName,
                sessionId: this.sessionIdGeo,
                userName: this.username,
              },
            },
          })
          .then((response) => {
            console.log(response);
            this.loading = false;
          })
          .catch((error) => {
            console.log(error);
            this.loading = false;
            this.error = true;
            this.success = false;
            this.errorCode = error;
          });
      },

      getDeviceStatusInfo() {
        this.status = "Getting device status info...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "DeviceStatusInfo",
              search: {
                deviceSearch: { id: this.devicesId[0] },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
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
              this.deviceStatusInfo = data;
              console.log("DeviceStatusInfo: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },

      getTrailerAttachment() {
        this.status = "Getting trailer attachment...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "TrailerAttachmentPermalink",
              search: {
                deviceSearch: { id: this.devicesId[0] },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
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
              this.trailerAttachments = data;
              console.log("Trailer Attachments: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },

      getDVIRLog() {
        this.status = "Getting DVIR Log...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "DVIRLogPermalink",
              search: {
                deviceSearch: { id: this.devicesId[0] },
                defects: {},
                defectRemark: "",
                defectSeverity: "",
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
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
              this.dvirlog = data;
              console.log("DVIR Log: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },
      getFuelTaxDetail() {
        this.status = "Getting tax details...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "FuelTaxDetail",
              search: {
                deviceSearch: { id: this.devicesId[0] },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
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
              this.fuelTaxDetails = data;
              console.log("Tax Details: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },
      getLogRecord() {
        this.status = "Getting log record...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "LogRecord",
              search: {
                deviceSearch: { id: this.devicesId[0] },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
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
              this.logRecords = data;
              console.log("Log Records: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },
      getZone() {
        this.status = "Getting Zone...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "Zone",
              search: {
                deviceSearch: { id: this.devicesId[0] },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
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
              this.zone = data;
              console.log("Zone: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },
      getRoute() {
        this.status = "Getting Route...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "Route",
              search: {
                deviceSearch: { id: this.devicesId[0] },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
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
              this.route = data;
              console.log("Route: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },
      getAudit() {
        this.status = "Getting Audits...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "Audit",
              search: {
                deviceSearch: { id: this.devicesId[0] },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
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
              this.audit = data;
              console.log("Audit: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },
      getTextMessage() {
        this.status = "Getting text Messages...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "TextMessage",
              search: {
                deviceSearch: { id: this.devicesId[0] },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
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
              this.textMessages = data;
              console.log("Text Messages: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },
      getShipmentLog() {
        this.status = "Getting Shipment Logs...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "ShipmentLog",
              search: {
                deviceSearch: { id: this.devicesId[0] },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
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
              this.shipmentLogs = data;
              console.log("Shipment Log: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },
      getDriverRegulation() {
        this.status = "Getting Driver Regulation...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "DriverRegulation",
              search: {
                userSearch: { id: this.users[0].id },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
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
              this.driverRegulation = data;
              console.log("Driver Regulations: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },
      getDutyStatusLog() {
        this.status = "Getting Duty Status Log...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "DutyStatusLog",
              search: {
                userSearch: { id: this.users[0].id },
                deviceSearch: { id: this.devicesId[0] },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
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
              this.dutyStatusLogs = data;
              console.log("Duty Status Logs: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },
      getExceptionEvent() {
        this.status = "Getting Exception Events...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "ExceptionEvent",
              search: {
                deviceSearch: { id: this.devicesId[0] },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
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
              this.dutyStatusLogs = data;
              console.log("Duty Status Logs: ", data);
              this.success = true;
              this.loading = false;
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
        databases: [],
        account: "RUSH01",
        buttonMessage: "",
        deviceDatabases: [],
        status: "",
        progress: 0,
        deviceBillings: [],
        installLogs: [],
        devicePlans: [],
        parts: 100 / 2,
        methodName: "",
        indexName: "",
        typeName: "",
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
    },
  };
</script>
