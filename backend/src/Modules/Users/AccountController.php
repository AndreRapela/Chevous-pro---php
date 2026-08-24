<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Users;

use ChezVoust\Core\ApiException;
use ChezVoust\Core\Controller;
use ChezVoust\Core\Request;
use ChezVoust\Core\Response;
use ChezVoust\Core\Uuid;
use ChezVoust\Core\Validator;

final class AccountController extends Controller
{
    public function addresses(Request $request, array $params, ?array $auth): Response
    {
        $statement = $this->db->prepare(
            'SELECT public_id AS id, label, street, number, complement, neighborhood, city, state,
                    postal_code AS postalCode, is_default AS isDefault
             FROM addresses WHERE user_id = :user_id AND deleted_at IS NULL ORDER BY is_default DESC, created_at DESC'
        );
        $statement->execute(['user_id' => $auth['id']]);
        return Response::data($statement->fetchAll());
    }

    public function createAddress(Request $request, array $params, ?array $auth): Response
    {
        $data = $this->validatedAddress($request->body);
        $publicId = Uuid::v4();
        $this->db->beginTransaction();
        try {
            if (!empty($data['isDefault'])) {
                $this->db->prepare('UPDATE addresses SET is_default = 0 WHERE user_id = :user_id')->execute(['user_id' => $auth['id']]);
            }
            $this->db->prepare(
                'INSERT INTO addresses
                    (public_id, user_id, label, street, number, complement, neighborhood, city, state, postal_code, is_default, created_at, updated_at)
                 VALUES (:public_id, :user_id, :label, :street, :number, :complement, :neighborhood, :city, :state, :postal_code, :is_default, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
            )->execute([
                'public_id' => $publicId, 'user_id' => $auth['id'], 'label' => $data['label'], 'street' => $data['street'],
                'number' => $data['number'], 'complement' => $data['complement'] ?? null, 'neighborhood' => $data['neighborhood'],
                'city' => $data['city'], 'state' => strtoupper((string) $data['state']),
                'postal_code' => preg_replace('/\D+/', '', (string) $data['postalCode']), 'is_default' => !empty($data['isDefault']) ? 1 : 0,
            ]);
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
        return Response::data(['id' => $publicId] + $data, 201);
    }

    public function updateAddress(Request $request, array $params, ?array $auth): Response
    {
        $data = $this->validatedAddress($request->body);
        $address = $this->requireRow(
            'SELECT id FROM addresses WHERE public_id = :id AND user_id = :user_id AND deleted_at IS NULL',
            ['id' => $params['id'], 'user_id' => $auth['id']],
            'Endereço não encontrado.'
        );
        $this->db->beginTransaction();
        try {
            if (!empty($data['isDefault'])) {
                $this->db->prepare('UPDATE addresses SET is_default = 0 WHERE user_id = :user_id')->execute(['user_id' => $auth['id']]);
            }
            $this->db->prepare(
                'UPDATE addresses SET label = :label, street = :street, number = :number, complement = :complement,
                    neighborhood = :neighborhood, city = :city, state = :state, postal_code = :postal_code,
                    is_default = :is_default, updated_at = UTC_TIMESTAMP() WHERE id = :id'
            )->execute([
                'label' => $data['label'], 'street' => $data['street'], 'number' => $data['number'],
                'complement' => $data['complement'] ?? null, 'neighborhood' => $data['neighborhood'], 'city' => $data['city'],
                'state' => strtoupper((string) $data['state']), 'postal_code' => preg_replace('/\D+/', '', (string) $data['postalCode']),
                'is_default' => !empty($data['isDefault']) ? 1 : 0, 'id' => $address['id'],
            ]);
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
        return Response::data(['id' => $params['id']] + $data);
    }

    public function deleteAddress(Request $request, array $params, ?array $auth): Response
    {
        $statement = $this->db->prepare(
            'UPDATE addresses SET deleted_at = UTC_TIMESTAMP(), is_default = 0, updated_at = UTC_TIMESTAMP()
             WHERE public_id = :id AND user_id = :user_id AND deleted_at IS NULL'
        );
        $statement->execute(['id' => $params['id'], 'user_id' => $auth['id']]);
        if ($statement->rowCount() === 0) {
            throw new ApiException(404, 'ADDRESS_NOT_FOUND', 'Endereço não encontrado.');
        }
        return Response::noContent();
    }

    private function validatedAddress(array $body): array
    {
        return Validator::validate($body, [
            'label' => ['required', 'string', 'min:2', 'max:60'], 'street' => ['required', 'string', 'min:2', 'max:180'],
            'number' => ['required', 'string', 'max:20'], 'complement' => ['nullable', 'string', 'max:100'],
            'neighborhood' => ['required', 'string', 'max:100'], 'city' => ['required', 'string', 'max:100'],
            'state' => ['required', 'string', 'min:2', 'max:2'], 'postalCode' => ['required', 'string', 'min:8', 'max:9'],
            'isDefault' => ['sometimes', 'boolean'],
        ]);
    }
}
