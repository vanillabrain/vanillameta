import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FieldContent, FieldLabel } from '@/components/ui/field';
import { cn } from '@/lib/utils';

/** Radix select items always carry a string value; keep the empty choice addressable. */
export const SELECT_NONE_VALUE = '__none__';

function SelectForm(props) {
  const { t } = useTranslation();
  const {
    id,
    labelId: providedLabelId,
    label,
    optionList,
    endButton,
    value,
    labelField = 'label',
    valueField = 'value',
    required = false,
    disabledDefaultValue,
    name,
    onChange,
    inputProps,
    className,
    disabled,
    placeholder,
  } = props;
  const generatedId = useId();
  const generatedLabelId = useId();
  const controlId = id ?? generatedId;
  const labelId = providedLabelId ?? generatedLabelId;
  const explicitAriaLabel = inputProps?.['aria-label'] ?? props['aria-label'];

  const getDropList = (list: any[] | { value: any[]; label: any[] }) => {
    let dropDownList;
    if (list === undefined) {
      return [];
    }
    if (Array.isArray(list)) {
      if (list.length > 0 && list[0] instanceof Object) {
        dropDownList = [...list];
      } else {
        // value와 label이 같을 경우 배열
        dropDownList = list.map(item => ({ [valueField]: item, [labelField]: item }));
      }
    } else {
      // value와 label이 다를 경우 객체
      const listValues = list[valueField]; // ['sum', 'avg']
      const listLabels = list[labelField]; // ['합계', '평균']
      dropDownList = listValues.map((item, index) => ({ [valueField]: item, [labelField]: listLabels[index] }));
    }
    if (!disabledDefaultValue) {
      dropDownList.unshift({ [valueField]: '', [labelField]: t('common.selectNone') });
    }
    return dropDownList;
  };

  const dropList = getDropList(optionList);
  const itemValue = item => (String(item[valueField]) === '' ? SELECT_NONE_VALUE : String(item[valueField]));
  const selectedValue = value === undefined || value === null || value === '' ? SELECT_NONE_VALUE : String(value);

  const handleValueChange = next => {
    if (!onChange) {
      return;
    }
    // Restore the original option value so numeric and boolean contracts survive the string-only Radix API.
    const matched = next === SELECT_NONE_VALUE ? undefined : dropList.find(item => itemValue(item) === next);
    onChange({ target: { name, value: matched ? matched[valueField] : '' } });
  };

  return (
    <Field orientation="horizontal" className={cn('items-center gap-2', className)}>
      {label && (
        <FieldLabel id={labelId} htmlFor={controlId} className="w-[35%] flex-none truncate pr-2 capitalize">
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </FieldLabel>
      )}
      <FieldContent className={cn('flex flex-none flex-row items-center justify-between', label ? 'w-[65%]' : 'w-full')}>
        <Select value={selectedValue} onValueChange={handleValueChange} disabled={disabled} required={required}>
          <SelectTrigger
            id={controlId}
            aria-label={explicitAriaLabel}
            aria-labelledby={explicitAriaLabel ? undefined : label ? labelId : providedLabelId}
            className={cn('min-w-0 bg-background', endButton ? 'w-[calc(100%-38px)] shrink' : 'w-full')}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent position="popper">
            {dropList.map(item => (
              <SelectItem key={itemValue(item)} value={itemValue(item)}>
                {item[labelField]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!!endButton ? <div className="ml-1 w-[38px]">{endButton}</div> : null}
      </FieldContent>
    </Field>
  );
}

SelectForm.defaultProps = {
  optionList: [],
  required: false,
};

export default SelectForm;
