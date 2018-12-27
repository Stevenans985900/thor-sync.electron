<template>
    <v-expansion-panel-content v-bind="$attrs" v-on="$listeners" expand-icon>
        <v-layout row slot="header" align-center>
            <v-layout column>
                <div class="text-truncate">{{comment}}</div>
                <v-layout row align-center>
                    <b class="label primary mr-1">TX</b>
                    <b v-show="reverted" class="label warning">Reverted</b>
                    <v-spacer/>
                    <span class="caption grey--text">{{time}}</span>
                </v-layout>
            </v-layout>
            <v-btn
                icon
                small
                flat
                @click.stop="resend"
                class="my-0"
                style="margin-right:-8px;"
                :style="{'pointer-events': canResend? '':'none'}"
            >
                <v-icon small :color="iconColor">{{icon}}</v-icon>
            </v-btn>
        </v-layout>
        <v-card class="text-truncate">
            <v-card-text class="pt-1">
                <div v-show="!!hostname">
                    <v-icon small class="caption grey--text">mdi-web</v-icon>
                    <span class="text-truncate caption grey--text">{{hostname}}</span>
                </div>
                <v-layout align-center mb-2>
                    <AddressLabel icon style="width:27px;height:18px;border-radius:3px">{{signer}}</AddressLabel>
                    <span class="px-2 subheading">{{walletName}}</span>
                </v-layout>
                <v-layout>
                    <span class="caption grey--text">Amount</span>
                    <v-spacer/>
                    <Amount sym=" VET " prepend="-">{{amount}}</Amount>
                </v-layout>
                <v-layout>
                    <span class="caption grey--text">{{fee ? 'Fee':'Est. fee'}}</span>
                    <v-spacer/>
                    <Amount sym=" VTHO" prepend="-">{{fee || estimatedFee}}</Amount>
                </v-layout>

                <v-layout>
                    <span class="caption grey--text">Priority</span>
                    <v-spacer/>
                    <Priority :readonly="true" :priority="gasPriceCoef"/>
                </v-layout>

                <v-layout align-center>
                    <span class="caption grey--text">TXID</span>
                    <v-spacer/>
                    <v-btn primary small color="primary" flat icon class="ma-0" @click="reveal">
                        <v-icon small style="font-size:120%">mdi-link-variant</v-icon>
                    </v-btn>
                    <v-btn
                        primary
                        v-clipboard="txid"
                        small
                        color="primary"
                        flat
                        icon
                        class="ma-0 mr-1"
                    >
                        <v-icon small style="font-size:100%">mdi-content-copy</v-icon>
                    </v-btn>
                    <span>{{txid | shortTxId}}</span>
                </v-layout>
            </v-card-text>
        </v-card>
    </v-expansion-panel-content>
</template>
<script lang="ts">
import { Vue, Component, Prop } from 'vue-property-decorator'
import { describeClauses } from '@/common/formatter'
import * as UrlUtils from '@/common/url-utils'
import TimeAgo from 'timeago.js'
import { Transaction } from 'thor-devkit'
import BigNumber from 'bignumber.js'

const timeAgo = TimeAgo()

@Component
export default class TxActivityItem extends Vue {
    @Prop(Object) item !: entities.Activity<'tx'>

    get txObject() { return Transaction.decode(Buffer.from(this.item.data.raw.slice(2), 'hex')) }
    get comment() { return this.item.data.comment || describeClauses(this.item.data.message) }
    get hostname() { return UrlUtils.hostnameOf(this.item.referer.url) }
    get reverted() { return this.item.data.receipt ? this.item.data.receipt.reverted : false }
    get time() {
        this.$store.state.syncStatus // pulse
        return timeAgo.format(this.item.createdTime)
    }
    get txid() { return this.item.data.id }
    get signer() { return this.item.data.signer }
    get gasPriceCoef() { return this.txObject.body.gasPriceCoef }
    get estimatedFee() { return this.item.data.estimatedFee }
    get fee() { return this.item.data.receipt ? this.item.data.receipt.paid : '' }
    get amount() {
        return '0x' + this.item.data.message.reduce((sum, c) => {
            return sum.plus(c.value)
        }, new BigNumber(0)).toString(16)
    }
    get walletName() {
        const wallets = this.$store.state.wallets as entities.Wallet[]
        const wallet = wallets.find(w => w.address === this.signer)
        return wallet ? wallet.name : 'Unknown'
    }

    get status() {
        const headTs = this.$store.state.chainHead.timestamp as number
        if (this.item.data.receipt) {
            return this.item.closed ? 'confirmed' : 'confirming'
        } else if (this.item.closed) {
            return 'dropped'
        }

        const qStatus = TXER.status(this.item.data.id)
        if (!qStatus) {
            return 'hanging'
        }
        if (qStatus === 'error') {
            return 'error'
        }

        if (qStatus === 'sent' && headTs > this.item.data.timestamp + 10 * 60) {
            return 'timeout'
        }

        return 'sending'
    }
    get icon() {
        switch (this.status) {
            case 'confirmed': return 'mdi-check-circle-outline'
            case 'confirming': return 'mdi-progress-check'
            case 'sending': return 'mdi-progress-upload'
            case 'dropped': return 'mdi-alert-circle-outline'
            default: return 'mdi-restart'
        }
    }
    get iconColor() {
        switch (this.status) {
            case 'confirmed': return 'success'
            case 'confirming': return 'info'
            case 'sending': return 'warning'
            default: return 'error'
        }
    }
    get canResend() {
        return this.status === 'error' ||
            this.status === 'hanging' ||
            this.status === 'timeout'
    }

    resend() {
        TXER.send(this.item.data.id, this.item.data.raw)
    }

    reveal() {
        let href: string
        if (this.item.data.link) {
            const url = new URL(this.item.data.link)
            url.searchParams.append('txid', this.txid)
            href = url.href
        } else {
            href = this.item.referer.url
        }
        BUS.$emit('open-tab', { href })
    }
}
</script>