# Tempus

## Table of Contents

- [Introduction](#introduction)
- [Setup](#setup)
- [How to run](#how-to-run)
- [Contributing](#contributing)

## Introduction

An open data initiative for the ministry of health (originally intended for Ontario, Canada). This web client allows quick visualizations of health-related data and allows health workers (nurses, professionals) to update statistics in real-time.

**Note that data for visualizations is private and is not distributed with this repository.**

## Setup
- npm install (or yarn)
- bower install
- Set-up your Firebase and Auth0 credentials in `app/scripts/main.js`

## How to run

### Development
- Run gulp serve to preview and watch for changes
- Run bower install — save <package> to install frontend 
- Run gulp serve:dist to preview the production build

### Deployment
- Run gulp build
- Run firebase deploy

## Contributing

Pull requests will always be welcome!

### To-do

[ ] Move from Bower to NPM, Webpack

[ ] Add more features

[ ] Add testing

[ ] And more...
