// UndocumentedDirective.js
const { SchemaDirectiveVisitor } = require('graphql-tools');

class UndocumentedDirective extends SchemaDirectiveVisitor {

    //****************************************
    // These methods are standard SchemaDirectiveVisitor
    // methods to be overridden. They allow us to "mark"
    // the things that were decorated with this directive
    // by setting the `isDocumented` property to `true`
    //

    visitObject (subject) {
        subject.isUndocumented = true
    }

    visitEnum (subject) {
        subject.isUndocumented = true
    }

    visitFieldDefinition (subject) {
        subject.isUndocumented = true
    }

    //
    //****************************************

    //****************************************
    // These static methods are used by the
    // graphql-introspection-filtering library to decide
    // whether or not to show or hide things based on their
    // boolean responses
    //

    static visitTypeIntrospection (type) {
        return UndocumentedDirective.isAccessible(type)
    }

    static visitFieldIntrospection (field) {
        return UndocumentedDirective.isAccessible(field)
    }

    // Don't show that this directive itself exists
    static visitDirectiveIntrospection ({ name }) {
        return name !== 'undocumented'
    }

    //
    //****************************************

    // If the thing has not been marked by the directive to
    // be undocumented, then it's accessible
    static isAccessible (thing) {
        return !thing.isUndocumented
    }
}

module.exports.UndocumentedDirective = UndocumentedDirective;