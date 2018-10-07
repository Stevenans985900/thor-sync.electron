import LocalDB from './local-db'

class Preferences extends LocalDB<any> {
    constructor() {
        super('sync', 'preferences')
    }
}

namespace Preferences {
    export const PRIMARY_WALLET = 'primary-wallet'
}

export default Preferences
