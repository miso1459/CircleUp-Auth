<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import * as NavigationMenu from '$lib/components/ui/navigation-menu/index.js';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	let showModal = $state(false);
	let newName = $state('');
	let isLoading = $state(false);
	let errorMsg = $state('');
	let successMsg = $state('');

	function openProfileModal() {
		newName = data?.user?.name ?? '';
		errorMsg = '';
		successMsg = '';
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		errorMsg = '';
		successMsg = '';
	}

	async function updateName() {
		if (!newName.trim()) {
			errorMsg = '사용자를 입력해주세요.';
			return;
		}

		isLoading = true;
		errorMsg = '';
		successMsg = '';

		try {
			const res = await fetch('/api/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newName.trim() })
			});

			const result = await res.json();

			if (!res.ok) {
				errorMsg = result.error ?? '변경에 실패했습니다.';
				return;
			}

			successMsg = '사용자가 변경되었습니다!';
			// 레이아웃 데이터 갱신
			await invalidateAll();

			setTimeout(() => {
				closeModal();
			}, 800);
		} catch {
			errorMsg = '네트워크 오류가 발생했습니다.';
		} finally {
			isLoading = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeModal();
		if (e.key === 'Enter' && !isLoading) updateName();
	}
</script>

<NavigationMenu.Root viewport={false}>
	<NavigationMenu.List>
		<NavigationMenu.Item>
			<NavigationMenu.Trigger>
				<!-- 유저 정보가 있으면 이름 표시 -->
				{data?.user ? data.user.name : 'Login'}
			</NavigationMenu.Trigger>
			<NavigationMenu.Content
				class="right-0 left-auto min-w-30"
				style="--tw-enter-translate-x: 0px; --tw-exit-translate-x: 0px;"
			>
				<ul class="grid gap-4 p-2 profile-btn">
					{#if data?.user}
						<NavigationMenu.Link onclick={openProfileModal}>
							Profile
						</NavigationMenu.Link>	
						<NavigationMenu.Link href={resolve('/logout' as Pathname)} data-sveltekit-reload>
							Logout
						</NavigationMenu.Link>
					{:else}
						<NavigationMenu.Link
							href={resolve('/login?provider=google' as Pathname)}
							data-sveltekit-reload>
							Google
						</NavigationMenu.Link>
						<NavigationMenu.Link
							href={resolve('/login?provider=github' as Pathname)}
							data-sveltekit-reload>
							Github
						</NavigationMenu.Link>
					{/if}
				</ul>
			</NavigationMenu.Content>
		</NavigationMenu.Item>
	</NavigationMenu.List>
</NavigationMenu.Root>

<!-- 프로필 이름 변경 모달 -->
{#if showModal}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={closeModal} onkeydown={handleKeydown}>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="modal-container" onclick={(e) => e.stopPropagation()} onkeydown={handleKeydown}>
			<div class="modal-header">
				<h2 class="modal-title">프로필 수정</h2>
				<button type="button" class="modal-close" onclick={closeModal} aria-label="닫기">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="modal-body">
				<label class="input-label" for="profile-name">사용자</label>
				<input
					id="profile-name"
					type="text"
					class="input-field"
					bind:value={newName}
					placeholder="새 사용자를 입력하세요"
					maxlength={50}
					disabled={isLoading}
				/>

				{#if errorMsg}
					<p class="msg msg-error">{errorMsg}</p>
				{/if}
				{#if successMsg}
					<p class="msg msg-success">{successMsg}</p>
				{/if}
			</div>

			<div class="modal-footer">
				<button type="button" class="btn btn-cancel" onclick={closeModal} disabled={isLoading}>
					취소
				</button>
				<button type="button" class="btn btn-save" onclick={updateName} disabled={isLoading}>
					{#if isLoading}
						<span class="spinner"></span>
						저장 중...
					{:else}
						저장
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.profile-btn {
		all: unset;
		cursor: pointer;
		width: 100%;
		display: block;
		font: inherit;
		color: inherit;
	}

	.profile-btn:hover {
		opacity: 0.7;
	}

	/* 모달 오버레이 */
	.modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
		animation: fadeIn 0.2s ease-out;
	}

	/* 모달 컨테이너 */
	.modal-container {
		background: #fff;
		border-radius: 16px;
		box-shadow:
			0 25px 50px -12px rgba(0, 0, 0, 0.25),
			0 0 0 1px rgba(0, 0, 0, 0.05);
		width: 90%;
		max-width: 420px;
		padding: 0;
		animation: slideUp 0.25s ease-out;
		overflow: hidden;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 24px 12px;
		border-bottom: 1px solid #f0f0f0;
	}

	.modal-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: #1a1a2e;
		margin: 0;
	}

	.modal-close {
		all: unset;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		color: #6b7280;
		transition: all 0.15s ease;
	}

	.modal-close:hover {
		background: #f3f4f6;
		color: #1f2937;
	}

	.modal-body {
		padding: 20px 24px;
	}

	.input-label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
		margin-bottom: 6px;
	}

	.input-field {
		width: 100%;
		padding: 10px 14px;
		border: 1.5px solid #d1d5db;
		border-radius: 10px;
		font-size: 0.95rem;
		color: #1f2937;
		background: #fafafa;
		transition: all 0.15s ease;
		outline: none;
		box-sizing: border-box;
	}

	.input-field:focus {
		border-color: #6366f1;
		background: #fff;
		box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
	}

	.input-field:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.msg {
		margin-top: 10px;
		font-size: 0.85rem;
		font-weight: 500;
		border-radius: 8px;
		padding: 8px 12px;
	}

	.msg-error {
		color: #dc2626;
		background: #fef2f2;
		border: 1px solid #fecaca;
	}

	.msg-success {
		color: #059669;
		background: #ecfdf5;
		border: 1px solid #a7f3d0;
	}

	.modal-footer {
		display: flex;
		gap: 10px;
		justify-content: flex-end;
		padding: 16px 24px 20px;
		border-top: 1px solid #f0f0f0;
	}

	.btn {
		padding: 9px 20px;
		border-radius: 10px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		border: none;
		transition: all 0.15s ease;
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-cancel {
		background: #f3f4f6;
		color: #374151;
	}

	.btn-cancel:hover:not(:disabled) {
		background: #e5e7eb;
	}

	.btn-save {
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
		color: #fff;
		box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
	}

	.btn-save:hover:not(:disabled) {
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.45);
		transform: translateY(-1px);
	}

	.spinner {
		display: inline-block;
		width: 14px;
		height: 14px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(16px) scale(0.97);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
