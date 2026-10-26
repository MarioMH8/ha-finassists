import type { ReactElement } from 'react';

import { CategoryForm, CategoryList } from './components';
import { useCategories } from './use-categories.hook';

function CategoriesManagement(): ReactElement {
	const state = useCategories();

	return (
		<>
			<CategoryList
				cancelDelete={state.cancelDelete}
				categories={state.categories}
				confirmingCategoryId={state.confirmingCategoryId}
				copy={state.copy}
				deleteCategory={state.deleteCategory}
				deletingCategoryId={state.deletingCategoryId}
				feedback={state.feedback}
				filterKind={state.filterKind}
				isEditorOpen={state.isEditorOpen}
				listState={state.listState}
				openCreate={state.openCreate}
				openEdit={state.openEdit}
				setConfirmingCategoryId={state.setConfirmingCategoryId}
				setFilterKind={state.setFilterKind}
			/>
			<CategoryForm
				closeEditor={state.closeEditor}
				copy={state.copy}
				editingCategoryId={state.editingCategoryId}
				errors={state.errors}
				feedback={state.feedback}
				isEditorOpen={state.isEditorOpen}
				isSubmitting={state.isSubmitting}
				kind={state.kind}
				name={state.name}
				setKind={state.setKind}
				setName={state.setName}
				submit={state.submit}
			/>
		</>
	);
}

export { CategoriesManagement };
