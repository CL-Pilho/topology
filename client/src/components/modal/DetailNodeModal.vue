<template>
<modal
    class="w-modal"
    ref="detail_node_modal"
    id="detail-node"
    name="detail-node"
    :width="520"
    :height="520"
    :isAutoHeight="false"
    :reset="false"
    :clickToClose="true"
    :resizable="false"
    draggable=".modal-header">
    <div class="modal-header">
        <h5>Information</h5>
        <a class="close-modal-btn" role="button" @click="beforeModalClose()"><i class="el-icon-error"></i></a>
    </div>
    <div class="modal-body">
        <el-tabs>
            <el-tab-pane label="Info">Info</el-tab-pane>
        </el-tabs>
    </div>
    <div class="modal-footer">
        <el-button size="mini" @click="beforeModalClose()">CONFIRM</el-button>
    </div>
</modal>
</template>

<script>

export default {
    data () {
        return {
            
        }
    },
    components:{
    },
    methods: {
        show(d) {
            console.log(d);
            this.$modal.show('detail-node');
        },
        beforeModalClose() {
            this.$modal.hide('detail-node');
        }
    },
    beforeCreate(){

    },
    created() {
        console.log('created')
    },
    beforeRouteUpdate(to,from){

    },
    mounted() {
        console.log('mounted');
    },
    beforeUpdate() {

    },
    updated() {

    },
    beforeDestroy() {

    },
    destroyed() {
        console.log('destroyed')
    }
}
</script>
<style>

</style>