var formValidation = function(){
  var form          = $('form#card-details'),
  formInputs        = form.find('input'),
  errorSummary      = $('.error-summary'),
  chargeValidations = module.chargeValidation(i18n.chargeController.fieldErrors,console),
  required          = chargeValidations.required;


  var init = function(){
    form.on('submit',checkFormSubmission);
    formInputs.on('blur',checkPreviousFocused);
  },

  checkFormSubmission = function(e){
    var validations = allValidations(),
    fields = allFields();
    if (!validations.hasError) return;

    e.preventDefault();
    for (var field in fields) {
      checkValidation(fields[field]);
    }

    generateHighlightBlock();
  },

  generateHighlightBlock = function(){
    errorSummary.removeClass('hidden');
    $('.error-summary-list').empty();
    var errors = allValidations().highlightErrorFields;
    for (var key in errors) {
      id= findInputByKey(key);
      $('.error-summary-list').append("<li><a href='" + key + "-lbl' id='" + key + "-error'>" + errors[key] + "</a></li>");
    }

    location.hash = "";
    setTimeout(function(){
          location.hash = "#error-summary";
    },10);
  },

  checkPreviousFocused = function(){
    var input = this;
    setTimeout(function(){ // document.activelement is set to body unless you do this
      checkValidationInline(input);
    },50);
  },

  checkValidationInline = function(input){
    if ($(input).val().length === 0) return;
    var formGroup = getFormGroup(input),

    // validations can be combined e.g. expiry month and year
    focusedFormGroup = getFormGroup($(document.activeElement));
    if (focusedFormGroup.is(formGroup)) return;
    checkValidation(input);
  },

  checkValidation = function(input){
    var formGroup = getFormGroup(input),
    validationName= getFormGroupValidation(formGroup),
    validation    = validationFor(validationName);

    replaceLabel(validation, formGroup);
    $(formGroup).toggleClass('error',validation !== undefined);
  },

  replaceLabel = function(validation, formGroup){
    var label = formGroup.find('[data-label-replace]');
    if (label.length === 0) return;
    if (validation) {
      label.text(validation);
    } else {
      label.text(label.attr('data-original-label'));
    }
  },

  allFields = function(){
    var fields = {};
    $(required).each(function(index,requiredField){
      fields[requiredField] = $("input[name=" + requiredField + "]");
    });
    return fields;
  },

  allFieldValues = function(){
    var values = {};
    $(required).each(function(index,requiredField){
      values[requiredField] =findInputByKey(requiredField).val();
    });
    return values;
  },

  allValidations = function(){
    return chargeValidations.verify(allFieldValues());
  },

  validationFor = function(name){
     var validation =$.grep(allValidations().errorFields,function(validation){
      return validation.key == name;
    });
     if (!validation[0]) return;
     return validation[0].value;
  },

  getFormGroup = function(input) {
    return $(input).parents('.form-group');
  },

  getFormGroupValidation = function(formGroup){
    return $(formGroup).attr('data-validation');
  },
  findInputByKey = function(key){
    return $("input[name=" + key + "]");
  };


  init();
}();
