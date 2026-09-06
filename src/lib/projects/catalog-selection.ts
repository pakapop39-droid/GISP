export type CatalogOption = {
  id: string;
  name: string;
  isRequired: boolean;
  values: Array<{ id: string; label: string }>;
};

export type SelectedOption = {
  optionId: string;
  valueId: string;
  label: string;
};

export function buildProjectItemSelection(
  productOptions: CatalogOption[],
  selections: Record<string, string>,
) {
  const selectedOptions: SelectedOption[] = [];
  const missingRequiredOptions: string[] = [];

  for (const option of productOptions) {
    const selectedValue = option.values.find(
      (value) => value.id === selections[option.id],
    );

    if (selectedValue) {
      selectedOptions.push({
        optionId: option.id,
        valueId: selectedValue.id,
        label: selectedValue.label,
      });
    } else if (option.isRequired) {
      missingRequiredOptions.push(option.name);
    }
  }

  return { selectedOptions, missingRequiredOptions };
}
