<template>
<div style="height:100%">
<el-tabs class="left_tabs" type="border-card">
    <el-tab-pane>
        <span slot="label" class="tab_title"><i class="el-icon-share"></i>Controller</span>
        <el-tree class="demo" default-expand-all ref="controller_list"
             :data="data" :props="defaultProps" node-key="uuid" draggable :allow-drag="allowDrag" :allow-drop="allowDrop" @node-drag-start="onNodeDragStart">
             <!-- draggable :allow-drag="allowDrag" :allow-drop="allowDrop"  -->
            <span class="custom-tree-node" slot-scope="{ node, data }">
                <span><i :class="data.uuid === 'fluid' ? 'el-icon-goods' : 'el-icon-star-off'"></i>   {{ node.label }}</span>
                <!-- <span v-if="data.id !== 'fluid'">
                    <i class="el-icon-circle-plus-outline action" @click="append(data,$event)"></i>
                    <i v-if="data.id !== 'fluid'" class="el-icon-delete action" @click="remove(node,data,$event)"></i>
                </span> -->
            </span>
        </el-tree>
    </el-tab-pane>
</el-tabs>
</div>
</template>

<script>
let id = 1000;
import api from '../../api/api.js'

export default {
    data () {
        return {
            data: [{
                uuid:'fluid',
                name: 'FLUID',
                type:'folder',
                children: []
            }],
            defaultProps: {
                children: 'children',
                label: 'name'
            },
            selected_controllers :[]
        }
    },
    components:{
        
    },
    methods: {
        onNodeDragStart(node,e) {
            var transfer_data = {
                uuid:node.data.uuid,
                name:node.data.name
            }
            e.dataTransfer.setData("node", JSON.stringify(transfer_data));
        },
        allowDrop(dragNode, dropNode, type) {
            return false;
        },
        allowDrag(node) {
            return true;
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
        var me = this;
        api.getNetController().then(function(data) {
            me.data[0].children = data;
        })
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
<style scoped>
.demo {
    background : transparent;
}

.left_tabs { 
    height: 100%;
}

.tab_title {
    font-size : 12px;
}
.custom-tree-node {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 14px;
    padding-right: 8px;
}
.action {
    margin-left: 4px;
}
.action:hover {
    color: rgb(99,170,244);
}
</style>