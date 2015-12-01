# node-wechat-terminal

[![NPM](https://nodei.co/npm/node-wechat-terminal.png?downloads=true)](https://nodei.co/npm/node-wechat-terminal)

[![Build Status](https://travis-ci.org/goorockey/node-wechat-terminal.svg?branch=master)](https://travis-ci.org/goorockey/node-wechat-terminal)
[![node version](https://img.shields.io/badge/node.js-%3E%3D4.0.0-brightgreen.svg)](http://nodejs.org/download)
[![Codacy Badge](https://api.codacy.com/project/badge/grade/892f526d24c34902aca382a4e35b0842)](https://www.codacy.com/app/kelvingu616/node-wechat-terminal)
[![dependencies](https://david-dm.org/goorockey/node-wechat-terminal.png)](https://david-dm.org/goorockey/node-wechat-terminal)
[![devDependencies](https://david-dm.org/goorockey/node-wechat-terminal/dev-status.png)](https://david-dm.org/goorockey/node-wechat-terminal#info=devDependencies)
[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/goorockey/node-wechat-terminal/trend.png)](https://bitdeli.com/free "Bitdeli Badge")

Wechat client in terminal

## Requirement

- nodejs (>=4.0.0)

## Getting Started

    $ npm install -g node-wechat-terminal
    $ wechat-terminal

    (Login by scanning QRCode)

    UserName> \h  # show help message
    COMMAND              DESCRIPTION
    \h                   Print this help information
    \debug               Debug mode
    \network             Display network history
    \logout              Logout
    \user                Display user info
    \chat                List chat or select chat target by index
    \contact             List contact or select chat target by index
    \back                Quit chat
    \search              Search in contact
    \history             Display history of chat
    \room                List room in contact
    \member              List member of room

## Features

- List contacts

        Me>\contact
        Contacts:
        #0 Me
        #1 James
        #2 Stephen
        ...

- Search user in contacts

        Me>\search a
        #1 James
        #6 Harden

- Select target to chat by contact index, and send message

        Me>\contact 1
        Me => James>Hi

- Display chat history

        Me => James>\history
        Chat history with James:
        TIME      FROM    TO      MESSAGE
        14:00:00  Me      James   Hi

- Logout

        Me>\logout # or Ctrl-C / Ctrl-D

## Inspired by

- [uProxy_wechat](https://github.com/LeMasque/uProxy_wechat)

## License

  MIT
