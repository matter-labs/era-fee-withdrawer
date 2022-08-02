# Fee withdrawer

This repository contains the fee withdrawer script: a utility that is capable of withdrawing funds
from zkSync fee account in L2 to L1, and transferring funds to the
zkSync operator account, withdrawal finalizer account and reserve account.

## Utility lifecycle

Fee seller is expected to be run periodically, and upon each launch it sequentially does the following:

1. Check whether withdrawing ETH is reasonable. If so, withdraw funds to L1 account.
2. Check the L1 ETH balance on the fee account. If it's above configurable threshold, divide the amount between 3 accounts:
  - If zkSync operator account balance is lower than the threshold, send necessary amount to zkSync operator account.
  - If zkSync withdrawal finalizer account balance is lower than the threshold, send necessary amount to zkSync withdrawal finalizer account.
  - Otherwise, send to reserve account.
  
This way, script achieves the following goal:
we don't maintain all the funds on a single hot wallet (operator account). We keep the operator and withdrawer balances big
enough to work on its own for several days (e.g. 15 ETH), but all the excessive funds are transferred to
the cold wallet (reserve account).

## Configuration parameters

Configuration parameters should be set as environment variables.
See `index.ts` for details.

## Notifications

Notifications about operations performed by fee withdrawer are sent to mattermost (currently, to the `Notifications`
channel).
