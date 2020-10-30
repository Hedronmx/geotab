<template>
   <section class="section">
      <div class="container">
         <h1>Tabla Geotab!</h1>
      </div>
      <div class="container">
         <b-loading v-model="isLoading" :is-full-page="false"></b-loading>
         <b-table :data="usuarios" :columns="columnas" :paginated=true :narrowed=true :striped=true :hoverable=true :per-page="perPage" :current-page="currentPage" aria-next-label="Next" aria-previous-label="previous" ></b-table>
      </div>
   </section>
</template>

<script>
   const GeotabApi = require('mg-api-node');
   const api = new GeotabApi("mirandao@rushenterprises.com", "105Norma105!", "rush")
   import moment from 'moment'
   // method decodevins para sacar informacion del vehiculo
   export default {
      name: 'Demo',
      data: function () {
         return {
            isLoading: true,
            perPage: 20,
            currentPage: 1,
            usuarios: [],
            columnas: [
            {
               field: 'id',
               label: 'ID',
               sortable: true
            },
            {
               field: 'firstName',
               label: 'First Name',
               sortable: true
            },
            {
               field: 'lastName',
               label: 'Last Name',
               sortable: true
            },
            {
               field: 'acceptedEULA',
               label: 'EULA Accepted',
               sortable: true
            },
            {
               field: 'activeFrom',
               label: 'Active From',
               sortable: true
            },
            {
               field: 'activeTo',
               label: 'Active To',
               sortable: true
            },
            {
               field: 'authorityAddress',
               label: ' Authority Address',
               sortable: true
            }

            ]
         };
      },
      created: function () {
          api.authenticate( (err, data) => {
            api.call('Get', {
              typeName: 'User',
              search: {
                name: data.userName
              }
            }, (err, data) => {
              if(err){
                console.log('Error', err);
                return;
              }
              this.usuarios = data
              this.isLoading = false
            });
          });
      }
   }
</script>
